import "server-only";
import type { BattleEvent, FormatId, PlayerChoice, PlayerRequest, PublicBattleState, SideId } from "../../shared/contract/index.ts";
import { choiceToProtocol } from "./choices.ts";
import type { CreateEngineBattleInput, EngineSecrets } from "./contract.ts";
import { desync, invalidChoice, openingLines, projectSide, sanitizeShowdownMessage, withSession } from "./engine.ts";
import { mirrorEvents, mirrorState } from "./perspective.ts";
import type { BattleSession } from "./stream.ts";

/** Two-human battles. Both sides choose; Showdown resolves once both choices are in. */

export interface OnlineCheckpoint {
  turn: number;
  p1RequestRaw: string | null;
  p2RequestRaw: string | null;
}

/** One seat's slice of a step, already mirrored so that the seat owner is always `p1`. */
export interface SeatStep {
  events: BattleEvent[];
  state: PublicBattleState;
  /** Null once the battle ended. A side that already chose gets a `wait` request. */
  request: PlayerRequest | null;
}

export type OnlineEndReason = "normal" | "forfeit" | "timeout";

export interface OnlineStep {
  inputLogDelta: string[];
  /** True when Showdown produced new protocol (a turn resolved, a forced switch, the battle ended...). */
  advanced: boolean;
  seats: Record<SideId, SeatStep>;
  /** Sides that still owe Showdown a choice. */
  pending: Record<SideId, boolean>;
  checkpoint: OnlineCheckpoint;
  turn: number;
  ended: boolean;
  /** Engine side ids (p1 = challenger). */
  winner: SideId | "tie" | null;
  endReason: OnlineEndReason | null;
}

export type OnlineAction =
  | { kind: "choice"; side: SideId; choice: PlayerChoice }
  | { kind: "forfeit"; side: SideId }
  | { kind: "timeout"; sides: SideId[] };

function seatStep(session: BattleSession, side: SideId, formatId: FormatId, before: number): SeatStep {
  const projected = projectSide(session, side, formatId, before);
  let request = projected.request;
  if (request && !session.mustChoose(side)) request = { ...request, kind: "wait", moves: [] };
  if (side === "p1") return { events: projected.events, state: projected.state, request };
  return { events: mirrorEvents(projected.events), state: mirrorState(projected.state), request };
}

function buildOnlineStep(
  session: BattleSession,
  formatId: FormatId,
  before: Record<SideId, number>,
  inputLogDelta: string[],
  endReason: OnlineEndReason | null,
): OnlineStep {
  const ended = session.ended;
  const advanced = session.p1Lines.length !== before.p1 || session.p2Lines.length !== before.p2;
  return {
    inputLogDelta,
    advanced,
    seats: {
      p1: seatStep(session, "p1", formatId, before.p1),
      p2: seatStep(session, "p2", formatId, before.p2),
    },
    pending: { p1: !ended && session.mustChoose("p1"), p2: !ended && session.mustChoose("p2") },
    checkpoint: {
      turn: session.turn,
      p1RequestRaw: ended ? null : session.requestRaw("p1"),
      p2RequestRaw: ended ? null : session.requestRaw("p2"),
    },
    turn: session.turn,
    ended,
    winner: session.winner(),
    endReason: ended ? (endReason ?? "normal") : null,
  };
}

export async function createOnlineEngineBattle(
  input: CreateEngineBattleInput,
): Promise<{ secrets: EngineSecrets; step: OnlineStep }> {
  const { secrets, lines } = openingLines(input);
  const step = await withSession(async (session) => {
    await session.replay(lines);
    return buildOnlineStep(session, secrets.formatId, { p1: 0, p2: 0 }, [...lines], null);
  });
  return { secrets, step };
}

export async function applyOnlineAction(
  secrets: EngineSecrets,
  checkpoint: OnlineCheckpoint,
  action: OnlineAction,
): Promise<OnlineStep> {
  return withSession(async (session) => {
    await session.replay(secrets.inputLog);
    if (
      session.turn !== checkpoint.turn ||
      (session.ended ? null : session.requestRaw("p1")) !== checkpoint.p1RequestRaw ||
      (session.ended ? null : session.requestRaw("p2")) !== checkpoint.p2RequestRaw
    ) {
      throw desync();
    }
    if (session.ended) throw invalidChoice("La batalla ya terminó.");

    const before = { p1: session.p1Lines.length, p2: session.p2Lines.length };
    const written: string[] = [];
    let endReason: OnlineEndReason | null = null;

    if (action.kind === "forfeit") {
      const line = `>forcelose ${action.side}`;
      await session.writeLine(line);
      written.push(line);
      endReason = "forfeit";
    } else if (action.kind === "timeout") {
      const sides = [...new Set(action.sides)];
      if (sides.length === 0) throw invalidChoice("Sin lados expirados.");
      const line = sides.length === 2 ? ">forcetie" : `>forcelose ${sides[0]}`;
      await session.writeLine(line);
      written.push(line);
      endReason = "timeout";
    } else {
      const { side, choice } = action;
      if (!session.mustChoose(side)) {
        throw invalidChoice(session.isActionable(side) ? "Ya elegiste. Esperando al rival." : "No hay una decisión pendiente.");
      }
      if (choice.kind === "teamPreview") {
        const pending = session.parsedRequest(side);
        const size = pending?.maxChosenTeamSize ?? pending?.side.pokemon.length;
        if (!pending?.teamPreview || choice.order.length !== size) {
          throw invalidChoice("El orden debe incluir todos los Pokémon del equipo.");
        }
      }
      const line = `>${side} ${choiceToProtocol(choice)}`;
      const errors = await session.writeLine(line);
      const rejected = errors.find((error) => error.side === side);
      if (rejected) throw invalidChoice(sanitizeShowdownMessage(rejected.message));
      written.push(line);
    }

    return buildOnlineStep(session, secrets.formatId, before, written, endReason);
  });
}
