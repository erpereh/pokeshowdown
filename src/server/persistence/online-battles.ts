import "server-only";
import type {
  ActionResponse,
  BattleFrame,
  BattleView,
  FormatId,
  PublicBattleState,
  SideId,
} from "../../shared/contract/index.ts";
import { EngineDesyncError, InvalidChoiceError, type EngineSecrets, type PlayerAction } from "../battle-engine/index.ts";
import {
  applyOnlineAction,
  createOnlineEngineBattle,
  type OnlineAction,
  type OnlineCheckpoint,
  type OnlineStep,
} from "../battle-engine/online.ts";
import { ApiException } from "../http/error.ts";
import { ENGINE_VERSION } from "../showdown/index.ts";
import type { DbClient } from "../supabase/admin.ts";
import type { Database, Json } from "../supabase/database.types.ts";
import { backgroundForBattle } from "./backgrounds.ts";
import { choiceMessage, storedActionMatches } from "./battles.ts";
import { emptyBattleState, toBattleView } from "./map-battle.ts";
import { isOnline, loadPresence } from "./presence.ts";

type BattleRow = Database["public"]["Tables"]["battles"]["Row"];
type MatchRow = Database["public"]["Tables"]["online_matches"]["Row"];
type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];

const MAX_COMMIT_ATTEMPTS = 4;

function internal(where: string, code?: string): ApiException {
  console.error(`[online] ${where}`, code ?? "");
  return new ApiException(500, "internal", "Error interno");
}

function seatOf(match: MatchRow, userId: string): SideId {
  if (match.p1_user_id === userId) return "p1";
  if (match.p2_user_id === userId) return "p2";
  throw new ApiException(404, "not_found", "Partida no encontrada");
}

/** Showdown runs with internal names; each seat shows its owner's and rival's display names. */
function nameState(state: PublicBattleState, me: string, rival: string): PublicBattleState {
  return {
    ...state,
    sides: {
      p1: { ...state.sides.p1, name: me },
      p2: { ...state.sides.p2, name: rival },
    },
  };
}

function seatFrame(step: OnlineStep, side: SideId, index: number, me: string, rival: string): BattleFrame {
  const seat = step.seats[side];
  return { index, events: seat.events, state: nameState(seat.state, me, rival) };
}

function seatRequest(step: OnlineStep, side: SideId): Json {
  return (step.seats[side].request ?? {}) as unknown as Json;
}

export async function loadMatch(admin: DbClient, matchId: string): Promise<MatchRow> {
  const { data, error } = await admin.from("online_matches").select("*").eq("id", matchId).maybeSingle();
  if (error) throw internal("match", error.code);
  if (!data) throw new ApiException(404, "not_found", "Partida no encontrada");
  return data;
}

async function loadSeat(admin: DbClient, battleId: string): Promise<BattleRow> {
  const { data, error } = await admin.from("battles").select("*").eq("id", battleId).maybeSingle();
  if (error) throw internal("seat", error.code);
  if (!data) throw new ApiException(404, "not_found", "Partida no encontrada");
  return data;
}

async function loadMatchSecrets(
  admin: DbClient,
  match: MatchRow,
): Promise<{ secrets: EngineSecrets; checkpoint: OnlineCheckpoint }> {
  const { data, error } = await admin.from("online_match_secrets").select("*").eq("match_id", match.id).maybeSingle();
  if (error || !data) throw internal("secrets", error?.code ?? "missing");
  return {
    secrets: {
      formatId: match.format_id as FormatId,
      engineVersion: match.engine_version,
      seed: data.seed,
      p1Team: data.p1_team,
      p2Team: data.p2_team,
      inputLog: data.input_log,
    },
    checkpoint: data.checkpoint as unknown as OnlineCheckpoint,
  };
}

/** Creates the shared match and both seats once both players are ready. Idempotent per challenge. */
export async function startOnlineMatch(
  admin: DbClient,
  challenge: ChallengeRow,
  teams: { p1Team: string | null; p2Team: string | null },
  names: { p1: string; p2: string },
): Promise<string> {
  const formatId = challenge.format_id as FormatId;
  const created = await createOnlineEngineBattle({
    formatId,
    ...(formatId === "gen9ou" ? { p1Team: teams.p1Team ?? "", p2Team: teams.p2Team ?? "" } : {}),
  });
  const { secrets, step } = created;
  const matchId = crypto.randomUUID();
  const p1BattleId = crypto.randomUUID();
  const p2BattleId = crypto.randomUUID();
  const { data, error } = await admin.rpc("create_online_match", {
    p_match_id: matchId,
    p_challenge_id: challenge.id,
    p_engine_version: secrets.engineVersion || ENGINE_VERSION,
    p_background: backgroundForBattle(matchId),
    p_p1_battle_id: p1BattleId,
    p_p2_battle_id: p2BattleId,
    p_p1_name: names.p1,
    p_p2_name: names.p2,
    p_turn: step.turn,
    p_p1_request: seatRequest(step, "p1"),
    p_p2_request: seatRequest(step, "p2"),
    p_p1_initial: emptyBattleState(names.p1, names.p2) as unknown as Json,
    p_p2_initial: emptyBattleState(names.p2, names.p1) as unknown as Json,
    p_p1_frame: seatFrame(step, "p1", 0, names.p1, names.p2) as unknown as Json,
    p_p2_frame: seatFrame(step, "p2", 0, names.p2, names.p1) as unknown as Json,
    p_p1_pending: step.pending.p1,
    p_p2_pending: step.pending.p2,
    p_seed: secrets.seed,
    p_p1_team: secrets.p1Team,
    p_p2_team: secrets.p2Team,
    p_input_log: secrets.inputLog,
    p_checkpoint: step.checkpoint as unknown as Json,
  });
  if (error || !data) {
    if (error?.code === "P0025") throw new ApiException(409, "conflict", "El desafío ya no está listo para empezar");
    throw internal("create_online_match", error?.code ?? "empty");
  }
  return data;
}

async function commitStep(
  admin: DbClient,
  match: MatchRow,
  step: OnlineStep,
  actor: { side: SideId; clientActionId: string; action: PlayerAction } | { timeoutSides: SideId[] },
) {
  const [p1Seat, p2Seat] = await Promise.all([loadSeat(admin, match.p1_battle_id), loadSeat(admin, match.p2_battle_id)]);
  const isTimeout = "timeoutSides" in actor;
  const args = {
    p_match_id: match.id,
    p_expected_revision: match.revision,
    p_actor_side: isTimeout ? null : actor.side,
    p_client_request_id: isTimeout ? null : actor.clientActionId,
    p_kind: isTimeout ? "timeout" : actor.action.kind,
    p_choice: isTimeout || actor.action.kind !== "choice" ? null : (actor.action.choice as unknown as Json),
    p_timeout_sides: isTimeout ? actor.timeoutSides : null,
    p_input_log_delta: step.inputLogDelta,
    p_checkpoint: step.checkpoint as unknown as Json,
    p_advanced: step.advanced,
    p_p1_frame: seatFrame(step, "p1", p1Seat.revision, p1Seat.player_name, p1Seat.cpu_name) as unknown as Json,
    p_p2_frame: seatFrame(step, "p2", p2Seat.revision, p2Seat.player_name, p2Seat.cpu_name) as unknown as Json,
    p_p1_request: seatRequest(step, "p1"),
    p_p2_request: seatRequest(step, "p2"),
    p_p1_pending: step.pending.p1,
    p_p2_pending: step.pending.p2,
    p_turn: step.turn,
    p_status: step.ended ? "finished" : "active",
    p_winner: step.winner,
    p_end_reason: step.endReason,
  };
  const { error } = await admin.rpc(
    "commit_online_step",
    args as unknown as Database["public"]["Functions"]["commit_online_step"]["Args"],
  );
  return error;
}

/**
 * Lazily applies an expired per-decision deadline. Any read of the match (either player, the battle
 * list or the friends screen) can resolve it, so no permanently running function is required.
 * The database re-checks the deadline against its own clock.
 */
export async function resolveTimeouts(admin: DbClient, match: MatchRow): Promise<boolean> {
  if (match.status !== "active" || match.timer_seconds == null) return false;
  const now = Date.now();
  const expired: SideId[] = [];
  if (match.p1_pending && match.p1_deadline && new Date(match.p1_deadline).getTime() <= now) expired.push("p1");
  if (match.p2_pending && match.p2_deadline && new Date(match.p2_deadline).getTime() <= now) expired.push("p2");
  if (expired.length === 0) return false;

  const { secrets, checkpoint } = await loadMatchSecrets(admin, match);
  const step = await applyOnlineAction(secrets, checkpoint, { kind: "timeout", sides: expired });
  const error = await commitStep(admin, match, step, { timeoutSides: expired });
  if (!error) return true;
  if (error.code === "P0003" || error.code === "P0004" || error.code === "P0005") return false;
  throw internal("timeout", error.code);
}

/** Resolves expired deadlines in every active match of this user (used by lists and the friends screen). */
export async function resolveUserTimeouts(admin: DbClient, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("online_matches")
    .select("*")
    .eq("status", "active")
    .not("timer_seconds", "is", null)
    .or(`p1_user_id.eq.${userId},p2_user_id.eq.${userId}`)
    .limit(20);
  if (error) throw internal("user matches", error.code);
  for (const match of data ?? []) await resolveTimeouts(admin, match);
}

async function onlineInfo(admin: DbClient, match: MatchRow, side: SideId, opponentName: string) {
  const opponentId = side === "p1" ? match.p2_user_id : match.p1_user_id;
  const presence = await loadPresence(admin, opponentId ? [opponentId] : []);
  const rival: SideId = side === "p1" ? "p2" : "p1";
  return {
    matchId: match.id,
    opponentName,
    opponentOnline: opponentId ? isOnline(presence.get(opponentId)) : false,
    myPending: match.status === "active" && match[`${side}_pending`],
    opponentPending: match.status === "active" && match[`${rival}_pending`],
    myDeadline: match[`${side}_deadline`],
    opponentDeadline: match[`${rival}_deadline`],
    timerSeconds: (match.timer_seconds as 60 | 120 | null) ?? null,
    serverNow: new Date().toISOString(),
  } satisfies BattleView["online"];
}

/** Seat view with live online data; resolves an expired deadline first. */
export async function getOnlineBattleView(admin: DbClient, userId: string, row: BattleRow): Promise<BattleView> {
  if (!row.match_id) throw new ApiException(404, "not_found", "Partida no encontrada");
  let match = await loadMatch(admin, row.match_id);
  const side = seatOf(match, userId);
  if (await resolveTimeouts(admin, match)) {
    match = await loadMatch(admin, row.match_id);
    row = await loadSeat(admin, row.id);
  }
  return { ...toBattleView(row), online: await onlineInfo(admin, match, side, row.cpu_name) };
}

async function seatView(admin: DbClient, userId: string, battleId: string): Promise<BattleView> {
  const row = await loadSeat(admin, battleId);
  if (row.owner_id !== userId) throw new ApiException(404, "not_found", "Partida no encontrada");
  return getOnlineBattleView(admin, userId, row);
}

async function replayedOnlineAction(
  admin: DbClient,
  userId: string,
  battleId: string,
  clientActionId: string,
  action: PlayerAction,
): Promise<ActionResponse | null> {
  const { data, error } = await admin
    .from("battle_actions")
    .select("kind, p1_choice")
    .eq("battle_id", battleId)
    .eq("client_request_id", clientActionId)
    .maybeSingle();
  if (error) throw internal("action", error.code);
  if (!data) return null;
  const view = await seatView(admin, userId, battleId);
  if (!storedActionMatches(data.kind, data.p1_choice, action)) {
    throw new ApiException(409, "bad_request", "El identificador de acción ya se usó con otra elección", view);
  }
  return { view, newFrames: [], replayed: true };
}

export async function commitOnlineAction(
  admin: DbClient,
  userId: string,
  row: BattleRow,
  clientActionId: string,
  revision: number,
  action: PlayerAction,
): Promise<ActionResponse> {
  const replayed = await replayedOnlineAction(admin, userId, row.id, clientActionId, action);
  if (replayed) return replayed;

  let view = await getOnlineBattleView(admin, userId, row);
  if (view.status === "finished") throw new ApiException(409, "battle_finished", "La partida ya ha terminado", view);
  if (view.revision !== revision) throw new ApiException(409, "stale_revision", "La revisión no coincide", view);

  for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      // The rival committed meanwhile. Retry only while this seat's request is still the one answered.
      view = await seatView(admin, userId, row.id);
      if (view.status === "finished") throw new ApiException(409, "battle_finished", "La partida ya ha terminado", view);
      if (view.revision !== revision) throw new ApiException(409, "stale_revision", "La revisión no coincide", view);
    }
    const match = await loadMatch(admin, row.match_id!);
    const side = seatOf(match, userId);
    if (match.status === "finished") {
      view = await seatView(admin, userId, row.id);
      throw new ApiException(409, "battle_finished", "La partida ya ha terminado", view);
    }
    if (match.engine_version !== ENGINE_VERSION) {
      throw new ApiException(409, "engine_version_mismatch", "Partida creada con otra versión del motor", view);
    }
    const { secrets, checkpoint } = await loadMatchSecrets(admin, match);
    const engineAction: OnlineAction =
      action.kind === "forfeit" ? { kind: "forfeit", side } : { kind: "choice", side, choice: action.choice };
    let step: OnlineStep;
    try {
      step = await applyOnlineAction(secrets, checkpoint, engineAction);
    } catch (error) {
      if (error instanceof InvalidChoiceError) throw new ApiException(422, "invalid_choice", choiceMessage(error));
      if (error instanceof EngineDesyncError) throw internal("desync", match.id);
      throw error;
    }

    const error = await commitStep(admin, match, step, { side, clientActionId, action });
    if (!error) {
      const fresh = await seatView(admin, userId, row.id);
      const frame = step.advanced ? fresh.frames.at(-1) : undefined;
      return { view: fresh, newFrames: frame ? [frame] : [], replayed: false };
    }
    if (error.code === "23505") {
      const again = await replayedOnlineAction(admin, userId, row.id, clientActionId, action);
      if (again) return again;
      continue;
    }
    if (error.code === "P0004") continue;
    if (error.code === "P0003") {
      view = await seatView(admin, userId, row.id);
      throw new ApiException(409, "battle_finished", "La partida ya ha terminado", view);
    }
    throw internal("commit", error.code);
  }
  view = await seatView(admin, userId, row.id);
  throw new ApiException(409, "stale_revision", "La partida cambió mientras se enviaba la acción", view);
}

