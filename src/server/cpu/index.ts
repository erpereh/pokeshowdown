import "server-only";
import { CHOICE_PATTERN, type CpuInput } from "./contract.ts";
import { classifyRequest } from "./candidates.ts";
import { buildContext } from "./context.ts";
import { scoreMove, type ScoredMove } from "./scoring.ts";
import { rankSwitches, shouldSwitch, teamPreviewChoice } from "./switching.ts";
import { shouldTerastallize } from "./tera.ts";

function byScoreThenSlot(a: ScoredMove, b: ScoredMove): number {
  if (Math.abs(a.score - b.score) <= 1e-6) return a.slot - b.slot;
  return b.score - a.score;
}

function commit(choices: string[]): string[] {
  const ordered: string[] = [];
  for (const choice of choices) {
    if (choice === "default" || !CHOICE_PATTERN.test(choice) || ordered.includes(choice)) continue;
    ordered.push(choice);
  }
  ordered.push("default");
  return ordered;
}

/**
 * Ordered Showdown choices for the CPU. Always legal candidates from the request,
 * ending in `default`, except a `wait` request which needs no choice.
 * Never throws.
 */
export function chooseCpuActions(input: CpuInput): string[] {
  try {
    if (!input || typeof input !== "object") return ["default"];
    const decision = classifyRequest(input.request);
    if (decision.kind === "invalid" || decision.kind === "default") return ["default"];
    if (decision.kind === "wait") return [];

    const ctx = buildContext(input);
    if (decision.kind === "team") {
      const choice = teamPreviewChoice(ctx, decision.size);
      return choice ? commit([choice]) : ["default"];
    }
    if (decision.kind === "switch") {
      const ranked = rankSwitches(ctx, decision.slots);
      return commit(ranked.map((entry) => `switch ${entry.slot}`));
    }

    const scored = decision.moves.map((move) => scoreMove(ctx, move, false)).sort(byScoreThenSlot);
    const damaging = scored.filter((move) => move.damaging && move.effectiveness > 0);
    const bestDamage = damaging[0] ?? null;
    const best = scored[0] ?? null;
    const benches = rankSwitches(ctx, decision.switches);
    const switching = shouldSwitch(ctx, bestDamage?.score ?? 0, bestDamage?.effectiveness ?? 0, benches);
    const tera = !switching && decision.canTerastallize && best
      ? shouldTerastallize(ctx, best, decision.canTerastallize)
      : false;

    const moves = scored.map((move) => `move ${move.slot}`);
    const switches = benches.map((entry) => `switch ${entry.slot}`);
    const teraChoice = tera && best ? [`move ${best.slot} terastallize`] : [];
    return commit(switching ? [...switches, ...moves] : [...teraChoice, ...moves, ...switches]);
  } catch {
    return ["default"];
  }
}
