"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { apiFetch } from "@/client/api.ts";
import { createBrowserSupabase } from "@/lib/supabase/browser.ts";
import type { ChallengeStatus, FriendsOverview } from "@/shared/contract";

/**
 * Social state shared by every screen: friends overview, presence heartbeat and Realtime signals.
 * It lives at module level so it survives page navigations (each page mounts its own shell).
 * Realtime only says "something changed"; data is always refetched through the API.
 */

export interface ChallengeSignal {
  id: string;
  status: ChallengeStatus;
  challengerId: string;
  challengedId: string;
}

interface SocialState {
  userId: string | null;
  overview: FriendsOverview | null;
  error: boolean;
  /** Milliseconds to add to Date.now() to approximate the server clock. */
  skew: number;
}

const HEARTBEAT_MS = 30_000;
const REFRESH_MS = 30_000;

let state: SocialState = { userId: null, overview: null, error: false, skew: 0 };
const listeners = new Set<() => void>();
const challengeListeners = new Set<(signal: ChallengeSignal) => void>();
const matchListeners = new Set<(matchId: string) => void>();

let channel: RealtimeChannel | null = null;
let supabase: ReturnType<typeof createBrowserSupabase> | null = null;
let heartbeatTimer: number | null = null;
let refreshTimer: number | null = null;
let debounceTimer: number | null = null;
let inflight: Promise<void> | null = null;
let queued = false;

function emit(next: Partial<SocialState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSocial(): SocialState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function serverNow(): number {
  return Date.now() + state.skew;
}

export function skewFrom(serverIso: string): number {
  const server = new Date(serverIso).getTime();
  return Number.isFinite(server) ? server - Date.now() : 0;
}

export function refreshSocial(): Promise<void> {
  if (!state.userId) return Promise.resolve();
  if (inflight) {
    queued = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      const overview = await apiFetch<FriendsOverview>("/api/friends");
      const skew = skewFrom(overview.serverNow);
      emit({ overview, error: false, skew });
    } catch {
      emit({ error: true });
    } finally {
      inflight = null;
      if (queued) {
        queued = false;
        void refreshSocial();
      }
    }
  })();
  return inflight;
}

function scheduleRefresh() {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void refreshSocial();
  }, 250);
}

function beat() {
  if (document.visibilityState !== "visible") return;
  void apiFetch("/api/presence", { method: "POST", body: {} }).catch(() => undefined);
}

function onVisibility() {
  if (document.visibilityState === "visible") {
    beat();
    scheduleRefresh();
  }
}

export function onChallengeSignal(listener: (signal: ChallengeSignal) => void) {
  challengeListeners.add(listener);
  return () => {
    challengeListeners.delete(listener);
  };
}

/** Fires when an online match row the user takes part in changes (a commit, a timeout...). */
export function onMatchSignal(listener: (matchId: string) => void) {
  matchListeners.add(listener);
  return () => {
    matchListeners.delete(listener);
  };
}

async function openChannel(userId: string) {
  supabase ??= createBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  if (state.userId !== userId) return;
  if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
  const client = supabase;
  const onChallenge = (payload: { new: unknown }) => {
    const row = payload.new as { id?: string; status?: string; challenger_id?: string; challenged_id?: string } | null;
    if (row?.id && row.status && row.challenger_id && row.challenged_id) {
      const signal: ChallengeSignal = {
        id: row.id,
        status: row.status as ChallengeStatus,
        challengerId: row.challenger_id,
        challengedId: row.challenged_id,
      };
      for (const listener of challengeListeners) listener(signal);
    }
    scheduleRefresh();
  };
  const onMatch = (payload: { new: unknown }) => {
    const row = payload.new as { id?: string } | null;
    if (row?.id) for (const listener of matchListeners) listener(row.id);
    scheduleRefresh();
  };
  channel = client
    .channel(`social:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `addressee_id=eq.${userId}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `requester_id=eq.${userId}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `challenged_id=eq.${userId}` }, onChallenge)
    .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `challenger_id=eq.${userId}` }, onChallenge)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "online_matches", filter: `p1_user_id=eq.${userId}` }, onMatch)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "online_matches", filter: `p2_user_id=eq.${userId}` }, onMatch)
    .subscribe((status) => {
      // After a reconnection, refetch to catch anything missed while offline.
      if (status === "SUBSCRIBED") scheduleRefresh();
    });
}

function disconnect() {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
  heartbeatTimer = null;
  refreshTimer = null;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("online", onVisibility);
}

/** Idempotent: keeps one connection per signed-in user across page navigations. */
export function connectSocial(userId: string | null) {
  if (state.userId === userId) return;
  disconnect();
  emit({ userId, overview: null, error: false });
  if (!userId) return;
  beat();
  void refreshSocial();
  heartbeatTimer = window.setInterval(beat, HEARTBEAT_MS);
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void refreshSocial();
  }, REFRESH_MS);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onVisibility);
  void openChannel(userId);
}

export function pendingBadge(overview: FriendsOverview | null): number {
  if (!overview) return 0;
  const challenges = overview.challenges.filter((challenge) => challenge.role === "challenged" && challenge.status === "pending").length;
  return overview.incoming.length + challenges;
}
