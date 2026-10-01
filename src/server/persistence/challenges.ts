import "server-only";
import type {
  ChallengeConfig,
  ChallengeReadyBody,
  ChallengeStatus,
  ChallengeView,
  CreateChallengeBody,
  FormatId,
  PokemonSetData,
  PublicPlayer,
} from "../../shared/contract/index.ts";
import { ApiException } from "../http/error.ts";
import { createAdminSupabase, type DbClient } from "../supabase/admin.ts";
import type { Database } from "../supabase/database.types.ts";
import { unpackTeam } from "../teams/format.ts";
import { resolveOuTeam } from "./battles.ts";
import { loadPlayers } from "./friends.ts";
import { loadMatch, startOnlineMatch } from "./online-battles.ts";
import { isOnline, loadPresence } from "./presence.ts";

type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];

function internal(where: string, code?: string): ApiException {
  console.error(`[challenge] ${where}`, code ?? "");
  return new ApiException(500, "internal", "Error interno");
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function configOf(row: ChallengeRow): ChallengeConfig {
  return {
    formatId: row.format_id as FormatId,
    timerSeconds: (row.timer_seconds as 60 | 120 | null) ?? null,
    ouTeamSource: row.ou_team_source === "saved_or_random" ? "saved_or_random" : "saved",
    inviteTtlMinutes: row.invite_ttl_minutes as 2 | 5 | 10,
  };
}

async function expireStale(admin: DbClient, userId: string) {
  const { error } = await admin.rpc("expire_stale_challenges", { p_user: userId });
  if (error) throw internal("expire", error.code);
}

async function loadChallenge(admin: DbClient, userId: string, challengeId: string): Promise<ChallengeRow> {
  const { data, error } = await admin.from("challenges").select("*").eq("id", challengeId).maybeSingle();
  if (error) throw internal("load", error.code);
  if (!data || (data.challenger_id !== userId && data.challenged_id !== userId)) {
    throw new ApiException(404, "not_found", "Desafío no encontrado");
  }
  return data;
}

async function loadOwnTeam(admin: DbClient, challengeId: string, userId: string): Promise<PokemonSetData[] | null> {
  const { data, error } = await admin
    .from("challenge_entries")
    .select("packed_team")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw internal("entry", error.code);
  if (!data?.packed_team) return null;
  try {
    return unpackTeam(data.packed_team);
  } catch {
    return null;
  }
}

async function seatFor(admin: DbClient, row: ChallengeRow, userId: string): Promise<string | null> {
  if (!row.match_id) return null;
  const match = await loadMatch(admin, row.match_id);
  return match.p1_user_id === userId ? match.p1_battle_id : match.p2_user_id === userId ? match.p2_battle_id : null;
}

function buildView(
  row: ChallengeRow,
  userId: string,
  players: Map<string, PublicPlayer>,
  presence: Map<string, string>,
  extra: { team: PokemonSetData[] | null; battleId: string | null },
): ChallengeView {
  const challenger = row.challenger_id === userId;
  const opponentId = challenger ? row.challenged_id : row.challenger_id;
  const opponent = players.get(opponentId) ?? { userId: opponentId, displayName: "Entrenador", friendCode: "" };
  return {
    id: row.id,
    status: row.status as ChallengeStatus,
    config: configOf(row),
    role: challenger ? "challenger" : "challenged",
    opponent: {
      ...opponent,
      online: isOnline(presence.get(opponentId)),
      ready: challenger ? row.challenged_ready : row.challenger_ready,
    },
    me: { ready: challenger ? row.challenger_ready : row.challenged_ready, team: extra.team },
    expiresAt: toIso(row.expires_at) ?? row.expires_at,
    prepareExpiresAt: toIso(row.prepare_expires_at),
    battleId: extra.battleId,
    serverNow: new Date().toISOString(),
    createdAt: toIso(row.created_at) ?? row.created_at,
  };
}

async function viewOf(admin: DbClient, row: ChallengeRow, userId: string): Promise<ChallengeView> {
  const opponentId = row.challenger_id === userId ? row.challenged_id : row.challenger_id;
  const [players, presence, team, battleId] = await Promise.all([
    loadPlayers(admin, [opponentId]),
    loadPresence(admin, [opponentId]),
    loadOwnTeam(admin, row.id, userId),
    seatFor(admin, row, userId),
  ]);
  return buildView(row, userId, players, presence, { team, battleId });
}

export async function listOpenChallenges(admin: DbClient, userId: string): Promise<ChallengeView[]> {
  await expireStale(admin, userId);
  const { data, error } = await admin
    .from("challenges")
    .select("*")
    .in("status", ["pending", "preparing"])
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw internal("list", error.code);
  const rows = data ?? [];
  const others = rows.map((row) => (row.challenger_id === userId ? row.challenged_id : row.challenger_id));
  const [players, presence] = await Promise.all([loadPlayers(admin, others), loadPresence(admin, others)]);
  return rows.map((row) => buildView(row, userId, players, presence, { team: null, battleId: null }));
}

export async function createChallenge(userId: string, body: CreateChallengeBody): Promise<ChallengeView> {
  const admin = createAdminSupabase();
  if (body.opponentId === userId) throw new ApiException(400, "bad_request", "No puedes desafiarte a ti mismo");
  const { data, error } = await admin.rpc("create_challenge", {
    p_challenger: userId,
    p_challenged: body.opponentId,
    p_request_id: body.clientRequestId,
    p_format_id: body.formatId,
    p_timer_seconds: body.timerSeconds as number,
    p_ou_team_source: body.ouTeamSource,
    p_invite_ttl_minutes: body.inviteTtlMinutes,
  });
  if (error) {
    if (error.code === "P0022") throw new ApiException(403, "bad_request", "Solo puedes desafiar a tus amigos");
    if (error.code === "P0023") {
      const existing = typeof error.details === "string" && error.details ? error.details : undefined;
      throw new ApiException(409, "conflict", "Ya hay un desafío abierto entre vosotros", undefined, existing);
    }
    throw internal("create", error.code);
  }
  if (!data) throw internal("create empty");
  return viewOf(admin, await loadChallenge(admin, userId, data), userId);
}

/** Starts the battle when both are ready. Safe to call repeatedly: the RPC is idempotent per challenge. */
async function startIfReady(admin: DbClient, row: ChallengeRow): Promise<ChallengeRow> {
  if (row.status !== "preparing" || !row.challenger_ready || !row.challenged_ready) return row;
  const { data: entries, error } = await admin
    .from("challenge_entries")
    .select("user_id, packed_team")
    .eq("challenge_id", row.id);
  if (error) throw internal("entries", error.code);
  const teamOf = (id: string) => entries?.find((entry) => entry.user_id === id)?.packed_team ?? null;
  const players = await loadPlayers(admin, [row.challenger_id, row.challenged_id]);
  const name = (id: string) => (players.get(id)?.displayName ?? "Entrenador").slice(0, 32);
  if (row.format_id === "gen9ou" && (!teamOf(row.challenger_id) || !teamOf(row.challenged_id))) {
    throw new ApiException(409, "conflict", "Falta el equipo de un jugador");
  }
  await startOnlineMatch(
    admin,
    row,
    { p1Team: teamOf(row.challenger_id), p2Team: teamOf(row.challenged_id) },
    { p1: name(row.challenger_id), p2: name(row.challenged_id) },
  );
  const { data, error: reloadError } = await admin.from("challenges").select("*").eq("id", row.id).single();
  if (reloadError) throw internal("reload", reloadError.code);
  return data;
}

export async function getChallenge(userId: string, challengeId: string): Promise<ChallengeView> {
  const admin = createAdminSupabase();
  await expireStale(admin, userId);
  let row = await loadChallenge(admin, userId, challengeId);
  row = await startIfReady(admin, row);
  return viewOf(admin, row, userId);
}

export async function respondChallenge(userId: string, challengeId: string, action: "accept" | "decline" | "cancel") {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("respond_challenge", {
    p_user: userId,
    p_challenge_id: challengeId,
    p_action: action,
  });
  if (error) {
    if (error.code === "P0002") throw new ApiException(404, "not_found", "Desafío no encontrado");
    if (error.code === "P0021") throw new ApiException(409, "conflict", "El desafío ya no está disponible");
    throw internal("respond", error.code);
  }
  const view = await viewOf(admin, await loadChallenge(admin, userId, challengeId), userId);
  if (data === "expired") throw new ApiException(410, "expired", "La invitación ha caducado");
  return view;
}

export async function setChallengeReady(userId: string, challengeId: string, body: ChallengeReadyBody) {
  const admin = createAdminSupabase();
  const row = await loadChallenge(admin, userId, challengeId);
  if (row.status !== "preparing") throw new ApiException(409, "conflict", "El desafío ya no está en preparación");

  let packed: string | null = null;
  if (body.ready && row.format_id === "gen9ou") {
    if (!body.team) throw new ApiException(400, "bad_request", "Elige un equipo");
    if (body.team.kind === "random" && row.ou_team_source !== "saved_or_random") {
      throw new ApiException(422, "invalid_team", "Este desafío solo admite equipos guardados");
    }
    packed = await resolveOuTeam(admin, userId, body.team);
  }

  const { data: bothReady, error } = await admin.rpc("set_challenge_ready", {
    p_user: userId,
    p_challenge_id: challengeId,
    p_packed_team: packed as string,
    p_ready: body.ready,
  });
  if (error) {
    if (error.code === "P0024") throw new ApiException(410, "expired", "El tiempo de preparación ha terminado");
    if (error.code === "P0021") throw new ApiException(409, "conflict", "El desafío ya no está en preparación");
    if (error.code === "P0002") throw new ApiException(404, "not_found", "Desafío no encontrado");
    throw internal("ready", error.code);
  }
  let fresh = await loadChallenge(admin, userId, challengeId);
  if (bothReady) fresh = await startIfReady(admin, fresh);
  return viewOf(admin, fresh, userId);
}
