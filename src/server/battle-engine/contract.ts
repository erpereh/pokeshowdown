import type {
  BattleEvent,
  FormatId,
  PlayerChoice,
  PlayerRequest,
  PublicBattleState,
  SideId,
} from "../../shared/contract/index.ts";

/**
 * Everything needed to rebuild a battle deterministically with the same engine version.
 * Never sent to the browser.
 */
export interface EngineSecrets {
  formatId: FormatId;
  engineVersion: string;
  /** Showdown PRNG seed string (`sodium,<hex>`). */
  seed: string;
  /** Packed teams (`Teams.pack`), persisted for both formats. */
  p1Team: string;
  p2Team: string;
  /** Exact lines written to BattleStream, in order (`>start`, `>player`, `>p1 move 1`, `>forcelose p1`...). */
  inputLog: string[];
}

/** Values the persistence layer stores and uses to detect desync on rebuild. */
export interface EngineCheckpoint {
  turn: number;
  /** p1 request (raw Showdown JSON) expected after replaying `inputLog`; null when finished. */
  p1RequestRaw: string | null;
}

export interface EngineStep {
  /** Lines appended to `inputLog` by this step (player choice, CPU choices, forcelose...). */
  inputLogDelta: string[];
  /** Player-perspective events of this step (never contains hidden p2 information). */
  events: BattleEvent[];
  /** Player-perspective state after the step. */
  state: PublicBattleState;
  /** Pending player request with `rqid` still unset (0); persistence sets it to the new revision. */
  request: PlayerRequest | null;
  checkpoint: EngineCheckpoint;
  turn: number;
  ended: boolean;
  winner: SideId | "tie" | null;
  endReason: "normal" | "forfeit" | null;
}

export interface CreateEngineBattleInput {
  formatId: FormatId;
  /** Packed teams. Required for gen9ou; ignored for gen9randombattle (generated from the seed). */
  p1Team?: string;
  p2Team?: string;
  /** Optional fixed seed (tests); otherwise generated. */
  seed?: string;
}

export class InvalidChoiceError extends Error {
  readonly code = "invalid_choice";
}

export class EngineDesyncError extends Error {
  readonly code = "engine_desync";
}

/**
 * Public surface of `src/server/battle-engine/index.ts`:
 *
 * createEngineBattle(input): Promise<{ secrets: EngineSecrets; step: EngineStep }>
 *   Starts the battle, runs the CPU until the player must act (team preview or turn 1).
 *
 * applyPlayerAction(secrets, checkpoint, action): Promise<EngineStep>
 *   Rebuilds from `secrets`, asserts it matches `checkpoint` (else EngineDesyncError),
 *   applies the player's choice (InvalidChoiceError if Showdown rejects it) or forfeit,
 *   runs the CPU until the player must act again or the battle ends.
 *
 * rebuildView(secrets): Promise<EngineStep>   (diagnostics/tests: full replay as one step)
 */
export type PlayerAction = { kind: "choice"; choice: PlayerChoice } | { kind: "forfeit" };
