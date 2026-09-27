import "server-only";
import { CHOICE_PATTERN } from "./contract.ts";
import {
  parseCondition,
  speciesFromDetails,
  type CpuContext,
} from "./context.ts";
import { bestTypeEffectiveness, foePressure, typeMultiplier } from "./scoring.ts";

export interface BenchRank {
  slot: number;
  offensive: number;
  threat: number;
  score: number;
}

function speciesTypes(ctx: CpuContext, details: string | undefined): string[] {
  const species = ctx.dex.species.get(speciesFromDetails(details));
  return species.exists && species.types.length > 0 ? [...species.types] : ["Normal"];
}

export function rankSwitches(ctx: CpuContext, slots: number[]): BenchRank[] {
  const party = ctx.input.request.side?.pokemon ?? [];
  const foeTypes = ctx.foe?.types ?? ["Normal"];
  const ranked: BenchRank[] = [];
  for (const slot of slots) {
    const mon = party[slot - 1];
    if (!mon) continue;
    const types = speciesTypes(ctx, mon.details);
    const hp = parseCondition(mon.condition);
    if (hp.fainted || hp.maxHp <= 0) continue;
    const hpPct = hp.hp / hp.maxHp;
    let offensive = 0;
    for (const moveName of mon.moves ?? []) {
      const move = ctx.dex.moves.get(moveName);
      if (!move.exists || move.category === "Status") continue;
      const effectiveness = typeMultiplier(ctx.dex, move.type, foeTypes);
      if (effectiveness === 0) continue;
      const stab = types.includes(move.type) ? 1.5 : 1;
      const power = move.basePower > 0 ? move.basePower : 60;
      offensive = Math.max(offensive, power * stab * effectiveness);
    }
    if (offensive === 0) {
      offensive = 80 * 1.5 * bestTypeEffectiveness(ctx.dex, types, foeTypes);
    }
    const threat = ctx.foe ? foePressure(ctx, types) : 0;
    const jitter = (ctx.prng.next() - 0.5) * 1e-9;
    ranked.push({
      slot,
      offensive,
      threat,
      score: offensive * (0.3 + 0.7 * hpPct) - threat * 15 + jitter,
    });
  }
  ranked.sort((a, b) => {
    if (Math.abs(a.score - b.score) <= 1e-6) return a.slot - b.slot;
    return b.score - a.score;
  });
  return ranked;
}

export function shouldSwitch(ctx: CpuContext, activeScore: number, activeEffectiveness: number, benches: BenchRank[]): boolean {
  if (!ctx.foe || benches.length === 0) return false;
  if (activeEffectiveness >= 2 && activeScore >= 70) return false;
  if (activeScore >= 100 && activeEffectiveness >= 1) return false;
  const best = benches[0];
  if (!best) return false;
  const weak = activeEffectiveness <= 0.5 || activeScore < 50;
  if (!weak) return false;
  if (best.offensive < Math.max(65, activeScore * 1.25)) return false;
  const threatened = foePressure(ctx, ctx.self.types) >= 2;
  if (threatened && best.threat >= 2 && best.offensive < activeScore * 2) return false;
  return true;
}

export function teamPreviewChoice(ctx: CpuContext, size: number): string | null {
  const party = ctx.input.request.side?.pokemon ?? [];
  const n = Math.min(size, party.length, 6);
  if (n < 1) return null;
  const foes = ctx.foePreview;
  const scored = party.slice(0, n).map((mon, index) => {
    const types = speciesTypes(ctx, mon.details);
    let score = 0;
    if (foes.length > 0) {
      for (const foe of foes) {
        score += bestTypeEffectiveness(ctx.dex, types, foe.types) - bestTypeEffectiveness(ctx.dex, foe.types, types);
      }
      score /= foes.length;
    }
    return { slot: index + 1, score };
  });
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) <= 1e-6) return a.slot - b.slot;
    return b.score - a.score;
  });
  const digits = scored.map((entry) => String(entry.slot)).join("");
  const choice = `team ${digits}`;
  if (!CHOICE_PATTERN.test(choice)) return null;
  const seen = new Set(scored.map((entry) => entry.slot));
  if (seen.size !== n) return null;
  for (let slot = 1; slot <= n; slot += 1) {
    if (!seen.has(slot)) return null;
  }
  return choice;
}
