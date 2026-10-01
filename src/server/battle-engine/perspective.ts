import type { BattleEvent, PublicBattleState, SideId } from "../../shared/contract/index.ts";

/**
 * Online seats are stored as "p1 = the viewer", so every client component keeps working unchanged.
 * Showdown's p2 perspective is mirrored here: side ids swap in `side`, `id` and `winner` fields
 * (PokemonRef, SideView, teamPreview/sideStart/sideEnd, win) and the `sides` record swaps keys.
 * Names and other strings are never touched, so a nickname such as "p1" survives.
 */
const SIDE_KEYS = new Set(["side", "id", "winner"]);

function swapSide(value: SideId): SideId {
  return value === "p1" ? "p2" : "p1";
}

function mirrorValue(value: unknown, key: string | null): unknown {
  if (Array.isArray(value)) return value.map((entry) => mirrorValue(entry, null));
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    if (key === "sides" && "p1" in source && "p2" in source) {
      return { p1: mirrorValue(source.p2, null), p2: mirrorValue(source.p1, null) };
    }
    const out: Record<string, unknown> = {};
    for (const [entryKey, entry] of Object.entries(source)) out[entryKey] = mirrorValue(entry, entryKey);
    return out;
  }
  if (key !== null && SIDE_KEYS.has(key) && (value === "p1" || value === "p2")) return swapSide(value);
  return value;
}

export function mirrorState(state: PublicBattleState): PublicBattleState {
  return mirrorValue(state, null) as PublicBattleState;
}

export function mirrorEvents(events: BattleEvent[]): BattleEvent[] {
  return mirrorValue(events, null) as BattleEvent[];
}

export function mirrorWinner(winner: SideId | "tie" | null): SideId | "tie" | null {
  return winner === "p1" || winner === "p2" ? swapSide(winner) : winner;
}
