import "server-only";
import type {
  FriendEntry,
  FriendRequestEntry,
  FriendsOverview,
  PublicPlayer,
  SendFriendRequestResponse,
} from "../../shared/contract/index.ts";
import { ApiException } from "../http/error.ts";
import { createAdminSupabase, type DbClient } from "../supabase/admin.ts";
import { listOpenChallenges } from "./challenges.ts";
import { resolveUserTimeouts } from "./online-battles.ts";
import { isOnline, loadPresence, touchPresence } from "./presence.ts";

function internal(where: string, code?: string): ApiException {
  console.error(`[friends] ${where}`, code ?? "");
  return new ApiException(500, "internal", "Error interno");
}

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export async function loadPlayers(admin: DbClient, userIds: string[]): Promise<Map<string, PublicPlayer>> {
  const players = new Map<string, PublicPlayer>();
  if (userIds.length === 0) return players;
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, display_name, friend_code")
    .in("user_id", [...new Set(userIds)]);
  if (error) throw internal("profiles", error.code);
  for (const row of data ?? []) {
    players.set(row.user_id, { userId: row.user_id, displayName: row.display_name, friendCode: row.friend_code });
  }
  return players;
}

export async function areFriends(admin: DbClient, a: string, b: string): Promise<boolean> {
  const [low, high] = a < b ? [a, b] : [b, a];
  const { data, error } = await admin
    .from("friendships")
    .select("user_low")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();
  if (error) throw internal("friendship", error.code);
  return Boolean(data);
}

export async function getFriendsOverview(userId: string): Promise<FriendsOverview> {
  const admin = createAdminSupabase();
  await resolveUserTimeouts(admin, userId);

  const [friendships, requests, matches] = await Promise.all([
    admin.from("friendships").select("user_low, user_high, created_at").or(`user_low.eq.${userId},user_high.eq.${userId}`),
    admin
      .from("friend_requests")
      .select("id, requester_id, addressee_id, created_at")
      .eq("status", "pending")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("online_matches")
      .select("p1_user_id, p2_user_id, p1_battle_id, p2_battle_id")
      .eq("status", "active")
      .or(`p1_user_id.eq.${userId},p2_user_id.eq.${userId}`),
  ]);
  if (friendships.error) throw internal("list friendships", friendships.error.code);
  if (requests.error) throw internal("list requests", requests.error.code);
  if (matches.error) throw internal("list matches", matches.error.code);

  const challenges = await listOpenChallenges(admin, userId);
  const friendIds = (friendships.data ?? []).map((row) => (row.user_low === userId ? row.user_high : row.user_low));
  const requestIds = (requests.data ?? []).map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id));
  const [players, presence] = await Promise.all([
    loadPlayers(admin, [userId, ...friendIds, ...requestIds]),
    loadPresence(admin, friendIds),
  ]);

  const me = players.get(userId);
  if (!me) throw internal("own profile");

  const activeBattle = new Map<string, string>();
  for (const match of matches.data ?? []) {
    const mine = match.p1_user_id === userId;
    const rival = mine ? match.p2_user_id : match.p1_user_id;
    if (rival && !activeBattle.has(rival)) activeBattle.set(rival, mine ? match.p1_battle_id : match.p2_battle_id);
  }
  const openChallenge = new Map(challenges.map((challenge) => [challenge.opponent.userId, challenge.id]));

  const now = Date.now();
  const friends: FriendEntry[] = (friendships.data ?? []).flatMap((row) => {
    const friendId = row.user_low === userId ? row.user_high : row.user_low;
    const player = players.get(friendId);
    if (!player) return [];
    const lastSeenAt = presence.get(friendId) ?? null;
    return [{
      ...player,
      online: isOnline(lastSeenAt, now),
      lastSeenAt: lastSeenAt ? toIso(lastSeenAt) : null,
      since: toIso(row.created_at),
      challengeId: openChallenge.get(friendId) ?? null,
      activeBattleId: activeBattle.get(friendId) ?? null,
    }];
  });
  friends.sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName, "es"));

  const incoming: FriendRequestEntry[] = [];
  const outgoing: FriendRequestEntry[] = [];
  for (const row of requests.data ?? []) {
    const outgoingRequest = row.requester_id === userId;
    const player = players.get(outgoingRequest ? row.addressee_id : row.requester_id);
    if (!player) continue;
    (outgoingRequest ? outgoing : incoming).push({ id: row.id, user: player, createdAt: toIso(row.created_at) });
  }

  return { me, friends, incoming, outgoing, challenges, serverNow: new Date().toISOString() };
}

const SEND_ERRORS: Record<string, [number, "not_found" | "bad_request" | "conflict", string]> = {
  P0011: [404, "not_found", "No existe ningún entrenador con ese código"],
  P0012: [400, "bad_request", "Ese es tu propio código"],
  P0013: [409, "conflict", "Ya sois amigos"],
  P0014: [409, "conflict", "Tienes demasiadas solicitudes pendientes"],
};

export async function sendFriendRequest(userId: string, code: string): Promise<SendFriendRequestResponse> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("send_friend_request", { p_user: userId, p_code: code });
  if (error) {
    const mapped = SEND_ERRORS[error.code];
    if (mapped) throw new ApiException(mapped[0], mapped[1], mapped[2]);
    throw internal("send", error.code);
  }
  const status = (data as { status?: string } | null)?.status;
  return { status: status === "accepted" ? "accepted" : "sent" };
}

export async function respondFriendRequest(userId: string, requestId: string, action: "accept" | "decline" | "cancel") {
  const admin = createAdminSupabase();
  const { error } = await admin.rpc("respond_friend_request", { p_user: userId, p_request_id: requestId, p_action: action });
  if (!error) return;
  if (error.code === "P0002") throw new ApiException(404, "not_found", "Solicitud no encontrada");
  if (error.code === "P0015") throw new ApiException(409, "conflict", "La solicitud ya no está pendiente");
  throw internal("respond", error.code);
}

export async function removeFriend(userId: string, friendId: string) {
  const admin = createAdminSupabase();
  const { error } = await admin.rpc("remove_friend", { p_user: userId, p_friend: friendId });
  if (!error) return;
  if (error.code === "P0002") throw new ApiException(404, "not_found", "Amigo no encontrado");
  throw internal("remove", error.code);
}

export async function heartbeat(userId: string) {
  await touchPresence(createAdminSupabase(), userId);
}
