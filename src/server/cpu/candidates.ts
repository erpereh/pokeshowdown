import "server-only";
import type { ShowdownRequest } from "./contract.ts";

export interface LegalMove {
  /** 1-based index in the request's move list. */
  slot: number;
  id: string;
  name: string;
}

export type Decision =
  | { kind: "invalid" }
  | { kind: "wait" }
  | { kind: "default" }
  | { kind: "team"; size: number }
  | { kind: "switch"; slots: number[] }
  | {
      kind: "move";
      moves: LegalMove[];
      switches: number[];
      canTerastallize: string | null;
      trapped: boolean;
    };

function fainted(condition: string | undefined): boolean {
  return typeof condition === "string" && condition.endsWith(" fnt");
}

export function legalSwitchSlots(request: ShowdownRequest, trapped: boolean): number[] {
  if (trapped) return [];
  const party = request.side?.pokemon;
  if (!Array.isArray(party)) return [];
  const slots: number[] = [];
  for (let index = 0; index < party.length && index < 6; index += 1) {
    const mon = party[index];
    if (!mon || mon.active || mon.commanding) continue;
    if (fainted(mon.condition)) continue;
    slots.push(index + 1);
  }
  return slots;
}

export function classifyRequest(request: ShowdownRequest | null | undefined): Decision {
  if (!request || typeof request !== "object" || !request.side || !Array.isArray(request.side.pokemon)) {
    return { kind: "invalid" };
  }
  if (request.wait) return { kind: "wait" };
  if (request.side.pokemon.some((mon) => mon.reviving || mon.commanding)) {
    return { kind: "default" };
  }
  if (request.teamPreview) {
    const size = request.side.pokemon.length;
    if (size < 1 || size > 6) return { kind: "default" };
    return { kind: "team", size };
  }
  if (Array.isArray(request.forceSwitch) && request.forceSwitch.some(Boolean)) {
    return { kind: "switch", slots: legalSwitchSlots(request, false) };
  }
  const active = request.active?.[0];
  if (!request.active) return { kind: "invalid" };
  const trapped = Boolean(active?.trapped);
  const moves: LegalMove[] = [];
  for (const [index, move] of (active?.moves ?? []).entries()) {
    const slot = index + 1;
    if (slot > 4 || !move?.id || move.disabled) continue;
    moves.push({ slot, id: move.id, name: move.move || move.id });
  }
  const canTerastallize = typeof active?.canTerastallize === "string" && active.canTerastallize
    ? active.canTerastallize
    : null;
  return {
    kind: "move",
    moves,
    switches: legalSwitchSlots(request, trapped),
    canTerastallize,
    trapped,
  };
}
