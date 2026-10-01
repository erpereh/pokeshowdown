import "server-only";
import { ApiException } from "../http/error.ts";
import type { DbClient } from "../supabase/admin.ts";

/** A player counts as online while the app sent a heartbeat in this window (client beats every 30 s). */
export const ONLINE_WINDOW_MS = 75_000;

export async function touchPresence(admin: DbClient, userId: string): Promise<void> {
  const { error } = await admin.rpc("touch_presence", { p_user: userId });
  if (error) {
    console.error("[presence] touch", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
}

export async function loadPresence(admin: DbClient, userIds: string[]): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  if (userIds.length === 0) return seen;
  const { data, error } = await admin.from("user_presence").select("user_id, last_seen_at").in("user_id", userIds);
  if (error) {
    console.error("[presence] load", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  for (const row of data ?? []) seen.set(row.user_id, row.last_seen_at);
  return seen;
}

export function isOnline(lastSeenAt: string | undefined | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return Number.isFinite(seen) && now - seen <= ONLINE_WINDOW_MS;
}
