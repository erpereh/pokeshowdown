import type { FormatId, PublicBattleState, SideId } from "../../shared/contract/index.ts";

/** Raw Showdown request JSON as emitted in `sideupdate` (`|request|{...}`). */
export interface ShowdownRequest {
  wait?: boolean;
  teamPreview?: boolean;
  maxChosenTeamSize?: number;
  forceSwitch?: boolean[];
  noCancel?: boolean;
  update?: boolean;
  active?: Array<{
    moves: Array<{ move: string; id: string; pp?: number; maxpp?: number; target?: string; disabled?: boolean | string }>;
    trapped?: boolean;
    maybeTrapped?: boolean;
    maybeDisabled?: boolean;
    canTerastallize?: string;
  }>;
  side: {
    name: string;
    id: SideId;
    pokemon: Array<{
      ident: string;
      details: string;
      condition: string;
      active: boolean;
      stats: { atk: number; def: number; spa: number; spd: number; spe: number };
      moves: string[];
      baseAbility: string;
      ability?: string;
      item: string;
      pokeball?: string;
      teraType?: string;
      terastallized?: string;
      reviving?: boolean;
      commanding?: boolean;
    }>;
  };
}

export interface CpuInput {
  formatId: FormatId;
  /** The CPU's side (always "p2" in single player). */
  self: SideId;
  request: ShowdownRequest;
  /** State tracked from the CPU's own perspective: its side exact, the foe only as publicly revealed. */
  view: PublicBattleState;
  /** Deterministic key (e.g. `${seed}:${revision}`) for any randomness, so retries reproduce the same choice. */
  seedKey: string;
}

/**
 * `chooseCpuActions(input): string[]` from `src/server/cpu/index.ts` returns Showdown choice strings
 * ordered by preference. Each must match CHOICE_PATTERN. The engine tries them in order and falls
 * back to "default" if all are rejected.
 */
export const CHOICE_PATTERN = /^(move [1-4]( terastallize)?|switch [1-6]|team [1-6]{1,6}|default)$/;
