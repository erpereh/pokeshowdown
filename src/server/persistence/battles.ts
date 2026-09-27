import "server-only";
import type {
  BattleFrame,
  BattleStatus,
  BattleSummary,
  BattleView,
  CreateBattleBody,
  ForfeitBody,
  FormatId,
  PlayerChoice,
  PlayerRequest,
  SubmitActionBody,
  TeamSource,
  ValidationResult,
} from "../../shared/contract/index.ts";
import { ENGINE_VERSION } from "../showdown/index.ts";
import {
  applyPlayerAction,
  createEngineBattle,
  EngineDesyncError,
  InvalidChoiceError,
} from "../battle-engine/index.ts";
import type { EngineCheckpoint, EngineSecrets, EngineStep, PlayerAction } from "../battle-engine/contract.ts";
import { generateRandomOuTeam } from "../teams/random-ou.ts";
import { packTeam, unpackTeam, normalizeSet } from "../teams/format.ts";
import { validateTeam } from "../teams/validation.ts";
import { ApiException } from "../http/error.ts";
import { createAdminSupabase, type DbClient } from "../supabase/admin.ts";
import type { Database, Json } from "../supabase/database.types.ts";
import { backgroundForBattle } from "./backgrounds.ts";
import { emptyBattleState, frameAt, toBattleSummary, toBattleView, toReplayView } from "./map-battle.ts";
import type { ReplayView } from "../../shared/contract/battle.ts";

type BattleRow = Database["public"]["Tables"]["battles"]["Row"];

const CPU_NAME = "CPU";

function invalidTeam(result: ValidationResult): ApiException {
  const parts = result.problems.slice(0, 12).map((problem) => {
    const where = problem.setIndex === null ? "equipo" : `Pokémon ${problem.setIndex + 1}`;
    return `${where}: ${problem.message}`;
  });
  const message = parts.length > 0 ? `Equipo no válido. ${parts.join(" ")}` : "Equipo no válido";
  return new ApiException(422, "invalid_team", message);
}

function choiceMessage(error: InvalidChoiceError): string {
  const message = error.message.replace(/\s+/g, " ").trim();
  if (!message || message.length > 300) return "Elección no válida";
  return message;
}

async function loadPlayerName(admin: DbClient, userId: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[battle] profile", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  const name = data?.display_name?.trim();
  return name && name.length > 0 ? name.slice(0, 32) : "Player";
}

async function loadOwnedBattle(admin: DbClient, userId: string, battleId: string): Promise<BattleRow | null> {
  const { data, error } = await admin.from("battles").select("*").eq("id", battleId).eq("owner_id", userId).maybeSingle();
  if (error) {
    console.error("[battle] load", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  return data;
}

async function resolveOuTeam(admin: DbClient, userId: string, source: TeamSource): Promise<string> {
  if (source.kind === "random") {
    const sets = generateRandomOuTeam().map((set) => normalizeSet(set));
    const validation = validateTeam("gen9ou", sets);
    if (!validation.valid) throw invalidTeam(validation);
    return packTeam(sets);
  }

  if (source.kind === "inline") {
    const sets = source.sets.map((set) => normalizeSet(set));
    const validation = validateTeam("gen9ou", sets);
    if (!validation.valid) throw invalidTeam(validation);
    return packTeam(sets);
  }

  const { data, error } = await admin
    .from("teams")
    .select("packed_team")
    .eq("id", source.teamId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[battle] team", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!data) throw new ApiException(404, "not_found", "Equipo no encontrado");

  let sets;
  try {
    sets = unpackTeam(data.packed_team).map((set) => normalizeSet(set));
  } catch (error) {
    console.error("[battle] unpack", error instanceof Error ? error.message : "unknown");
    throw new ApiException(422, "invalid_team", "Equipo no válido");
  }
  const validation = validateTeam("gen9ou", sets);
  if (!validation.valid) throw invalidTeam(validation);
  return packTeam(sets);
}

export async function createBattle(userId: string, body: CreateBattleBody): Promise<BattleView> {
  const admin = createAdminSupabase();
  const existing = await loadByRequest(admin, userId, body.clientRequestId);
  if (existing) return toBattleView(existing);

  const playerName = await loadPlayerName(admin, userId);
  const battleId = crypto.randomUUID();
  const packed =
    body.formatId === "gen9ou"
      ? {
          p1Team: await resolveOuTeam(admin, userId, body.player),
          p2Team: await resolveOuTeam(admin, userId, body.cpu),
        }
      : {};

  const created = await createEngineBattle({
    formatId: body.formatId,
    ...packed,
  });
  return persistCreatedBattle(admin, {
    userId,
    battleId,
    clientRequestId: body.clientRequestId,
    playerName,
    created,
  });
}

async function loadByRequest(admin: DbClient, userId: string, clientRequestId: string): Promise<BattleRow | null> {
  const { data, error } = await admin
    .from("battles")
    .select("*")
    .eq("owner_id", userId)
    .eq("create_request_id", clientRequestId)
    .maybeSingle();
  if (error) {
    console.error("[battle] idempotency", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  return data;
}

async function persistCreatedBattle(
  admin: DbClient,
  input: {
    userId: string;
    battleId: string;
    clientRequestId: string;
    playerName: string;
    created: { secrets: EngineSecrets; step: EngineStep };
  },
): Promise<BattleView> {
  const { secrets, step } = input.created;
  if (!step.ended && !step.request) {
    console.error("[battle] create without request", input.battleId);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (step.ended && (step.winner == null || step.endReason == null)) {
    console.error("[battle] create ended without result", input.battleId);
    throw new ApiException(500, "internal", "Error interno");
  }

  const request = step.request ? { ...step.request, rqid: 1 } : null;
  const frame: BattleFrame = { index: 0, events: step.events, state: step.state };
  const status = step.ended ? "finished" : "active";
  const { data: storedId, error } = await admin.rpc("create_battle", {
    p_id: input.battleId,
    p_owner_id: input.userId,
    p_create_request_id: input.clientRequestId,
    p_format_id: secrets.formatId,
    p_engine_version: secrets.engineVersion || ENGINE_VERSION,
    p_background: backgroundForBattle(input.battleId),
    p_player_name: input.playerName,
    p_cpu_name: CPU_NAME,
    p_turn: step.turn,
    p_p1_request: (request ?? {}) as Json,
    p_initial_state: emptyBattleState(input.playerName, CPU_NAME) as unknown as Json,
    p_frame: frame as unknown as Json,
    p_seed: secrets.seed,
    p_p1_team: secrets.p1Team,
    p_p2_team: secrets.p2Team,
    p_input_log: secrets.inputLog,
    p_checkpoint: step.checkpoint as unknown as Json,
    p_status: status,
    p_winner: step.winner ?? undefined,
    p_end_reason: step.endReason ?? undefined,
  });
  if (error || !storedId) {
    console.error("[battle] create_battle", error?.code ?? "empty");
    throw new ApiException(500, "internal", "Error interno");
  }

  const row = await loadOwnedBattle(admin, input.userId, storedId);
  if (!row) throw new ApiException(500, "internal", "Error interno");
  return toBattleView(row);
}

export async function getBattleView(userId: string, battleId: string): Promise<BattleView> {
  const row = await loadOwnedBattle(createAdminSupabase(), userId, battleId);
  if (!row) throw new ApiException(404, "not_found", "Partida no encontrada");
  return toBattleView(row);
}

export async function listBattles(userId: string, status?: BattleStatus): Promise<BattleSummary[]> {
  const admin = createAdminSupabase();
  let query = admin
    .from("battles")
    .select("id, format_id, status, winner, end_reason, turn, created_at, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    console.error("[battle] list", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  return (data ?? []).map((row) => toBattleSummary(row));
}

export async function submitAction(userId: string, battleId: string, body: SubmitActionBody) {
  return commitAction(userId, battleId, body.clientActionId, body.revision, {
    kind: "choice",
    choice: body.choice,
  });
}

export async function forfeitBattle(userId: string, battleId: string, body: ForfeitBody) {
  return commitAction(userId, battleId, body.clientActionId, body.revision, { kind: "forfeit" });
}

async function commitAction(
  userId: string,
  battleId: string,
  clientActionId: string,
  revision: number,
  action: PlayerAction,
) {
  const admin = createAdminSupabase();
  const battle = await loadOwnedBattle(admin, userId, battleId);
  if (!battle) throw new ApiException(404, "not_found", "Partida no encontrada");

  const replayed = await replayedAction(admin, battle, clientActionId, action);
  if (replayed) return replayed;

  const view = toBattleView(battle);
  if (battle.status === "finished") {
    throw new ApiException(409, "battle_finished", "La partida ya ha terminado", view);
  }
  if (battle.revision !== revision) {
    throw new ApiException(409, "stale_revision", "La revisión no coincide", view);
  }
  if (battle.engine_version !== ENGINE_VERSION) {
    if (action.kind !== "forfeit") {
      throw new ApiException(409, "engine_version_mismatch", "Partida creada con otra versión del motor", view);
    }
    const secrets = await loadSecrets(admin, battle);
    const frame: BattleFrame = {
      index: battle.revision,
      events: [{ kind: "message", text: "Te has rendido.", pokemon: null }],
      state: view.state,
    };
    return persistCommit(admin, userId, battle, clientActionId, action, {
      frame,
      inputLogDelta: [">forcelose p1"],
      request: null,
      checkpoint: secrets.checkpoint,
      turn: battle.turn,
      status: "finished",
      winner: "p2",
      endReason: "forfeit",
    });
  }

  const secrets = await loadSecrets(admin, battle);
  let step: EngineStep;
  try {
    step = await applyPlayerAction(secrets.secrets, secrets.checkpoint, action);
  } catch (error) {
    if (error instanceof InvalidChoiceError) {
      throw new ApiException(422, "invalid_choice", choiceMessage(error));
    }
    if (error instanceof EngineDesyncError) {
      console.error("[battle] desync", battleId);
      throw new ApiException(500, "internal", "Error interno");
    }
    throw error;
  }

  if (step.ended && (step.winner == null || step.endReason == null)) {
    console.error("[battle] step ended without result", battleId);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!step.ended && !step.request) {
    console.error("[battle] step without request", battleId);
    throw new ApiException(500, "internal", "Error interno");
  }

  const nextRevision = battle.revision + 1;
  const frame: BattleFrame = { index: battle.revision, events: step.events, state: step.state };
  const request: PlayerRequest | null = step.request ? { ...step.request, rqid: nextRevision } : null;
  return persistCommit(admin, userId, battle, clientActionId, action, {
    frame,
    inputLogDelta: step.inputLogDelta,
    request,
    checkpoint: step.checkpoint,
    turn: step.turn,
    status: step.ended ? "finished" : "active",
    winner: step.winner,
    endReason: step.endReason,
  });
}

async function persistCommit(
  admin: DbClient,
  userId: string,
  battle: BattleRow,
  clientActionId: string,
  action: PlayerAction,
  step: {
    frame: BattleFrame;
    inputLogDelta: string[];
    request: PlayerRequest | null;
    checkpoint: EngineCheckpoint;
    turn: number;
    status: "active" | "finished";
    winner: "p1" | "p2" | "tie" | null;
    endReason: "normal" | "forfeit" | null;
  },
) {
  const choice: PlayerChoice | null = action.kind === "choice" ? action.choice : null;
  const { error } = await admin.rpc(
    "commit_battle_turn",
    {
      p_battle_id: battle.id,
      p_owner_id: userId,
      p_expected_revision: battle.revision,
      p_client_request_id: clientActionId,
      p_kind: action.kind,
      p_p1_choice: choice as unknown as Json,
      p_input_log_delta: step.inputLogDelta,
      p_frame: step.frame as unknown as Json,
      p_p1_request: (step.request ?? {}) as Json,
      p_checkpoint: step.checkpoint as unknown as Json,
      p_turn: step.turn,
      p_status: step.status,
      p_winner: (step.winner ?? "") as string,
      p_end_reason: (step.endReason ?? "") as string,
    } as Database["public"]["Functions"]["commit_battle_turn"]["Args"],
  );

  if (error) {
    if (error.code === "23505" || error.code === "P0003" || error.code === "P0004") {
      const fresh = await mustBattle(admin, userId, battle.id);
      const again = await replayedAction(admin, fresh, clientActionId, action);
      if (again) return again;
      const freshView = toBattleView(fresh);
      if (error.code === "P0003" || fresh.status === "finished") {
        throw new ApiException(409, "battle_finished", "La partida ya ha terminado", freshView);
      }
      throw new ApiException(409, "stale_revision", "La revisión no coincide", freshView);
    }
    if (error.code === "P0002") throw new ApiException(404, "not_found", "Partida no encontrada");
    console.error("[battle] commit", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }

  const fresh = await mustBattle(admin, userId, battle.id);
  return { view: toBattleView(fresh), newFrames: [step.frame], replayed: false };
}

async function mustBattle(admin: DbClient, userId: string, battleId: string): Promise<BattleRow> {
  const row = await loadOwnedBattle(admin, userId, battleId);
  if (!row) throw new ApiException(404, "not_found", "Partida no encontrada");
  return row;
}

async function replayedAction(admin: DbClient, battle: BattleRow, clientActionId: string, action: PlayerAction) {
  const { data, error } = await admin
    .from("battle_actions")
    .select("revision_before, kind, p1_choice")
    .eq("battle_id", battle.id)
    .eq("client_request_id", clientActionId)
    .maybeSingle();
  if (error) {
    console.error("[battle] action", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!data) return null;
  const view = toBattleView(battle);
  if (!storedActionMatches(data.kind, data.p1_choice, action)) {
    throw new ApiException(409, "bad_request", "El identificador de acción ya se usó con otra elección", view);
  }
  const frame = frameAt(view, data.revision_before);
  return { view, newFrames: frame ? [frame] : [], replayed: true as const };
}

function storedActionMatches(kind: string, storedChoice: Json | null, action: PlayerAction): boolean {
  if (kind !== action.kind) return false;
  if (action.kind === "forfeit") return storedChoice == null;
  return choiceKey(storedChoice) === choiceKey(action.choice);
}

function choiceKey(choice: Json | PlayerChoice | null): string {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return "invalid";
  const value = choice as { kind?: string; slot?: number; terastallize?: boolean; order?: number[] };
  if (value.kind === "move") return `move:${value.slot}:${value.terastallize === true}`;
  if (value.kind === "switch") return `switch:${value.slot}`;
  if (value.kind === "teamPreview" && Array.isArray(value.order)) return `team:${value.order.join(",")}`;
  return "invalid";
}

async function loadSecrets(admin: DbClient, battle: BattleRow): Promise<{ secrets: EngineSecrets; checkpoint: EngineCheckpoint }> {
  const { data, error } = await admin.from("battle_secrets").select("*").eq("battle_id", battle.id).maybeSingle();
  if (error || !data) {
    console.error("[battle] secrets", error?.code ?? "missing");
    throw new ApiException(500, "internal", "Error interno");
  }
  return {
    secrets: {
      formatId: battle.format_id as FormatId,
      engineVersion: battle.engine_version,
      seed: data.seed,
      p1Team: data.p1_team,
      p2Team: data.p2_team,
      inputLog: data.input_log,
    },
    checkpoint: data.checkpoint as unknown as EngineCheckpoint,
  };
}

export async function getReplay(userId: string, battleId: string): Promise<ReplayView> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("battle_replays")
    .select("*")
    .eq("battle_id", battleId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[battle] replay", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!data) throw new ApiException(404, "not_found", "Replay no encontrado");
  return toReplayView(data);
}
