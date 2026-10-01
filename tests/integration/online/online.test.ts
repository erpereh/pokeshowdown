import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiException } from "@/server/http/error.ts";
import { forfeitBattle, getBattleView, listBattles, submitAction } from "@/server/persistence/battles.ts";
import { createChallenge, getChallenge, respondChallenge, setChallengeReady } from "@/server/persistence/challenges.ts";
import { getFriendsOverview, removeFriend, respondFriendRequest, sendFriendRequest } from "@/server/persistence/friends.ts";
import { createAdminSupabase, type DbClient } from "@/server/supabase/admin.ts";
import type { Database } from "@/server/supabase/database.types.ts";
import type { BattleView, PlayerChoice } from "@/shared/contract/index.ts";

process.loadEnvFile?.(".env.local");

type UserClient = SupabaseClient<Database>;
interface TestUser {
  id: string;
  code: string;
  client: UserClient;
}

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

function firstChoice(view: BattleView): PlayerChoice {
  const request = view.request;
  if (!request || request.kind === "wait") throw new Error(`no actionable request in ${view.id}`);
  if (request.kind === "teamPreview") return { kind: "teamPreview", order: Array.from({ length: request.teamPreviewSize }, (_, i) => i + 1) };
  if (request.kind === "switch") {
    const slot = request.switches.find((entry) => !entry.disabled)?.slot;
    if (!slot) throw new Error("no switch");
    return { kind: "switch", slot };
  }
  const slot = request.moves.find((entry) => !entry.disabled)?.slot;
  if (!slot) throw new Error("no move");
  return { kind: "move", slot };
}

async function expectApiError(promise: PromiseLike<unknown>, status: number) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).status).toBe(status);
    return error as ApiException;
  }
  throw new Error(`expected HTTP ${status}`);
}

async function act(userId: string, view: BattleView) {
  return submitAction(userId, view.id, { clientActionId: crypto.randomUUID(), revision: view.revision, choice: firstChoice(view) });
}

describe("friends and online challenges", () => {
  let admin: DbClient;
  const users: TestUser[] = [];
  const created: string[] = [];
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;

  async function makeUser(name: string): Promise<TestUser> {
    const email = `online-qa+${crypto.randomUUID()}@pokeshowdown.test`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
    if (result.error || !result.data.user) throw result.error ?? new Error("user");
    created.push(result.data.user.id);
    const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: false, storage: memoryStorage() },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    const profile = await admin.from("profiles").select("friend_code").eq("user_id", result.data.user.id).single();
    const user = { id: result.data.user.id, code: profile.data!.friend_code, client };
    users.push(user);
    return user;
  }

  beforeAll(async () => {
    admin = createAdminSupabase();
    [a, b, c] = await Promise.all([makeUser("Ash QA"), makeUser("Misty QA"), makeUser("Brock QA")]);
  }, 60_000);

  // Only the temporary QA users of this run (and the matches they leave orphaned) are removed.
  afterAll(async () => {
    const matches = await admin.from("online_matches").select("id").or(created.map((id) => `p1_user_id.eq.${id},p2_user_id.eq.${id}`).join(","));
    for (const id of created) await admin.auth.admin.deleteUser(id);
    const ids = (matches.data ?? []).map((row) => row.id);
    if (ids.length > 0) await admin.from("online_matches").delete().in("id", ids).is("p1_user_id", null).is("p2_user_id", null);
  }, 60_000);

  it("gives every profile a permanent, unique friend code", async () => {
    expect(a.code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(new Set([a.code, b.code, c.code]).size).toBe(3);
    const direct = await a.client.from("profiles").update({ friend_code: "ZZZZZZZZ" }).eq("user_id", a.id);
    expect(direct.error).not.toBeNull();
    const viaAdmin = await admin.from("profiles").update({ friend_code: "ZZZZZZZZ" }).eq("user_id", a.id);
    expect(viaAdmin.error?.code).toBe("P0010");
  });

  it("handles requests: invalid code, self, send, duplicate, cancel, decline and accept", async () => {
    await expectApiError(sendFriendRequest(a.id, "AAAA-AAAA"), 404);
    await expectApiError(sendFriendRequest(a.id, a.code), 400);

    expect(await sendFriendRequest(a.id, c.code.toLowerCase())).toEqual({ status: "sent" });
    expect(await sendFriendRequest(a.id, `${c.code.slice(0, 4)}-${c.code.slice(4)}`)).toEqual({ status: "sent" });
    let overviewC = await getFriendsOverview(c.id);
    expect(overviewC.incoming).toHaveLength(1);
    const requestId = overviewC.incoming[0]!.id;
    expect(overviewC.incoming[0]!.user).toEqual({ userId: a.id, displayName: "Ash QA", friendCode: a.code });
    await expectApiError(respondFriendRequest(c.id, requestId, "cancel"), 404);
    await respondFriendRequest(a.id, requestId, "cancel");
    await expectApiError(respondFriendRequest(c.id, requestId, "accept"), 409);

    await sendFriendRequest(a.id, c.code);
    overviewC = await getFriendsOverview(c.id);
    await respondFriendRequest(c.id, overviewC.incoming[0]!.id, "decline");
    expect((await getFriendsOverview(a.id)).friends).toHaveLength(0);

    await sendFriendRequest(a.id, b.code);
    const overviewB = await getFriendsOverview(b.id);
    await respondFriendRequest(b.id, overviewB.incoming[0]!.id, "accept");
    await expectApiError(sendFriendRequest(b.id, a.code), 409);
    const overviewA = await getFriendsOverview(a.id);
    expect(overviewA.friends.map((friend) => friend.userId)).toEqual([b.id]);
    expect(JSON.stringify(overviewA)).not.toContain("@pokeshowdown.test");
  });

  it("auto-accepts crossed requests", async () => {
    await sendFriendRequest(b.id, c.code);
    expect(await sendFriendRequest(c.id, b.code)).toEqual({ status: "accepted" });
    expect((await getFriendsOverview(c.id)).friends.map((friend) => friend.userId)).toContain(b.id);
  });

  it("enforces RLS on social tables and hides server-only data", async () => {
    const thirdRequests = await c.client.from("friend_requests").select("id").eq("requester_id", a.id).eq("addressee_id", b.id);
    expect(thirdRequests.data).toEqual([]);
    const thirdFriendships = await c.client.from("friendships").select("user_low").or(`user_low.eq.${a.id},user_high.eq.${a.id}`);
    expect(thirdFriendships.data).toEqual([]);
    const presence = await a.client.from("user_presence").select("user_id");
    expect(presence.error).not.toBeNull();
    const write = await a.client.from("friendships").insert({ user_low: a.id < c.id ? a.id : c.id, user_high: a.id < c.id ? c.id : a.id });
    expect(write.error).not.toBeNull();
    const othersProfile = await a.client.from("profiles").select("user_id").eq("user_id", b.id);
    expect(othersProfile.data).toEqual([]);
  });

  it("only lets friends challenge and resolves simultaneous challenges to one", async () => {
    await expectApiError(
      createChallenge(a.id, { clientRequestId: crypto.randomUUID(), opponentId: c.id, formatId: "gen9randombattle", timerSeconds: null, ouTeamSource: "saved", inviteTtlMinutes: 5 }),
      403,
    );
    const config = { formatId: "gen9randombattle" as const, timerSeconds: 60 as const, ouTeamSource: "saved" as const, inviteTtlMinutes: 2 as const };
    const results = await Promise.allSettled([
      createChallenge(a.id, { ...config, clientRequestId: crypto.randomUUID(), opponentId: b.id }),
      createChallenge(b.id, { ...config, clientRequestId: crypto.randomUUID(), opponentId: a.id }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const conflict = (rejected[0] as PromiseRejectedResult).reason as ApiException;
    expect(conflict.status).toBe(409);
    const open = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof createChallenge>>>).value;
    expect(conflict.challengeId).toBe(open.id);

    // Idempotent per client request id.
    const requestId = crypto.randomUUID();
    const creator = results[0]!.status === "fulfilled" ? a : b;
    await respondChallenge(creator.id, open.id, "cancel");
    const first = await createChallenge(a.id, { ...config, clientRequestId: requestId, opponentId: b.id });
    const again = await createChallenge(a.id, { ...config, clientRequestId: requestId, opponentId: b.id });
    expect(again.id).toBe(first.id);

    // Third parties cannot see or touch it; nobody can rewrite the rules.
    expect((await c.client.from("challenges").select("id").eq("id", first.id)).data).toEqual([]);
    await expectApiError(getChallenge(c.id, first.id), 404);
    const tamper = await b.client.from("challenges").update({ timer_seconds: 120 }).eq("id", first.id);
    expect(tamper.error).not.toBeNull();
    const adminTamper = await admin.from("challenges").update({ format_id: "gen9ou" }).eq("id", first.id);
    expect(adminTamper.error?.code).toBe("P0020");
    await expectApiError(respondChallenge(a.id, first.id, "accept"), 404);
    await respondChallenge(b.id, first.id, "decline");
    expect((await getChallenge(a.id, first.id)).status).toBe("declined");
    await expectApiError(respondChallenge(b.id, first.id, "accept"), 409);
  });

  it("expires invitations lazily", async () => {
    // Same row the RPC would create, but with its 2-minute deadline already elapsed.
    const inserted = await admin
      .from("challenges")
      .insert({
        challenger_id: a.id,
        challenged_id: b.id,
        format_id: "gen9randombattle",
        timer_seconds: null,
        ou_team_source: "saved",
        invite_ttl_minutes: 2,
        expires_at: new Date(Date.now() - 1_000).toISOString(),
        create_request_id: crypto.randomUUID(),
      })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();
    await expectApiError(respondChallenge(b.id, inserted.data!.id, "accept"), 410);
    expect((await getChallenge(a.id, inserted.data!.id)).status).toBe("expired");
  });

  it("plays an online battle: concurrent ready, simultaneous choices, isolation, timeout, history", async () => {
    const challenge = await createChallenge(a.id, {
      clientRequestId: crypto.randomUUID(),
      opponentId: b.id,
      formatId: "gen9randombattle",
      timerSeconds: 60,
      ouTeamSource: "saved",
      inviteTtlMinutes: 5,
    });
    expect((await getFriendsOverview(b.id)).challenges.map((entry) => entry.id)).toContain(challenge.id);
    await expectApiError(setChallengeReady(a.id, challenge.id, { ready: true }), 409);
    const accepted = await respondChallenge(b.id, challenge.id, "accept");
    expect(accepted.status).toBe("preparing");
    expect(accepted.config).toEqual(challenge.config);

    await Promise.all([setChallengeReady(a.id, challenge.id, { ready: true }), setChallengeReady(b.id, challenge.id, { ready: true })]);
    const [lobbyA, lobbyB] = await Promise.all([getChallenge(a.id, challenge.id), getChallenge(b.id, challenge.id)]);
    expect(lobbyA.status).toBe("started");
    expect(lobbyA.battleId).toBeTruthy();
    expect(lobbyB.battleId).toBeTruthy();
    expect(lobbyA.battleId).not.toBe(lobbyB.battleId);
    const matches = await admin.from("online_matches").select("id").eq("challenge_id", challenge.id);
    expect(matches.data).toHaveLength(1);

    let viewA = await getBattleView(a.id, lobbyA.battleId!);
    let viewB = await getBattleView(b.id, lobbyB.battleId!);
    expect(viewA.mode).toBe("online");
    expect(viewA.online?.opponentName).toBe("Misty QA");
    expect(viewB.online?.opponentName).toBe("Ash QA");
    expect(viewA.state.sides.p1.name).toBe("Ash QA");
    expect(viewB.state.sides.p1.name).toBe("Misty QA");
    expect(viewA.online?.myDeadline).toBeTruthy();
    // Each seat sees exact HP only for its own team.
    expect(viewA.state.sides.p2.team.every((mon) => mon.maxHp === 100)).toBe(true);
    expect(viewB.state.sides.p2.team.every((mon) => mon.maxHp === 100)).toBe(true);
    expect(viewA.state.sides.p2.team.every((mon) => mon.moves.length === 0)).toBe(true);

    // Seats and secrets are private.
    await expectApiError(getBattleView(b.id, viewA.id), 404);
    expect((await b.client.from("battles").select("id").eq("id", viewA.id)).data).toEqual([]);
    expect((await a.client.from("online_match_secrets").select("match_id")).error).not.toBeNull();
    expect((await a.client.from("challenge_entries").select("challenge_id")).error).not.toBeNull();
    expect((await c.client.from("online_matches").select("id").eq("id", viewA.online!.matchId)).data).toEqual([]);
    expect((await a.client.from("online_matches").select("id").eq("id", viewA.online!.matchId)).data).toHaveLength(1);

    // Simultaneous choices resolve one turn exactly once.
    const [resultA, resultB] = await Promise.all([act(a.id, viewA), act(b.id, viewB)]);
    viewA = await getBattleView(a.id, viewA.id);
    viewB = await getBattleView(b.id, viewB.id);
    expect(viewA.revision).toBe(2);
    expect(viewB.revision).toBe(2);
    expect(resultA.newFrames.length + resultB.newFrames.length).toBe(1);
    // A faint may leave a single forced switch; settle until both owe a regular move.
    for (let guard = 0; guard < 20 && !(viewA.online?.myPending && viewB.online?.myPending); guard += 1) {
      if (viewA.online?.myPending) await act(a.id, viewA);
      if (viewB.online?.myPending) await act(b.id, viewB);
      viewA = await getBattleView(a.id, viewA.id);
      viewB = await getBattleView(b.id, viewB.id);
    }
    expect(viewA.status).toBe("active");

    // One side waits for the other; a second choice is rejected; replays are idempotent.
    const clientActionId = crypto.randomUUID();
    const choiceA = firstChoice(viewA);
    const waiting = await submitAction(a.id, viewA.id, { clientActionId, revision: viewA.revision, choice: choiceA });
    expect(waiting.newFrames).toHaveLength(0);
    expect(waiting.view.request?.kind).toBe("wait");
    expect(waiting.view.online?.opponentPending).toBe(true);
    const replay = await submitAction(a.id, viewA.id, { clientActionId, revision: viewA.revision, choice: choiceA });
    expect(replay.replayed).toBe(true);
    await expectApiError(act(a.id, { ...viewA, request: viewA.request }), 422);

    // B lets the clock run out: the deadline is authoritative and resolved lazily on any read.
    const live = await admin.from("online_matches").select("revision").eq("id", viewA.online!.matchId).single();
    await expectApiError(
      admin.rpc("commit_online_step", {
        p_match_id: viewA.online!.matchId, p_expected_revision: live.data!.revision, p_actor_side: null!, p_client_request_id: null!, p_kind: "timeout",
        p_choice: null, p_timeout_sides: ["p2"], p_input_log_delta: [], p_checkpoint: {}, p_advanced: false, p_p1_frame: null, p_p2_frame: null,
        p_p1_request: {}, p_p2_request: {}, p_p1_pending: false, p_p2_pending: false, p_turn: 0, p_status: "active", p_winner: null!, p_end_reason: null!,
      }).then(({ error }) => { if (error) throw new ApiException(error.code === "P0005" ? 409 : 500, "conflict", error.code); }),
      409,
    );
    await admin.from("online_matches").update({ p2_deadline: new Date(Date.now() - 5_000).toISOString() }).eq("id", viewA.online!.matchId);
    const listed = await listBattles(a.id, "finished");
    const finishedA = listed.find((summary) => summary.id === viewA.id);
    expect(finishedA).toMatchObject({ mode: "online", opponentName: "Misty QA", result: "win", endReason: "timeout" });
    viewB = await getBattleView(b.id, viewB.id);
    expect(viewB).toMatchObject({ status: "finished", result: "loss", endReason: "timeout" });
    const replays = await admin.from("battle_replays").select("owner_id, result").in("battle_id", [viewA.id, viewB.id]);
    expect(replays.data?.map((row) => `${row.owner_id === a.id ? "a" : "b"}:${row.result}`).sort()).toEqual(["a:win", "b:loss"]);
    await expectApiError(forfeitBattle(a.id, viewA.id, { clientActionId: crypto.randomUUID(), revision: viewA.revision + 1 }), 409);
  }, 240_000);

  it("finishes by forfeit and cancels open challenges when friends are removed", async () => {
    const challenge = await createChallenge(b.id, {
      clientRequestId: crypto.randomUUID(),
      opponentId: a.id,
      formatId: "gen9randombattle",
      timerSeconds: null,
      ouTeamSource: "saved",
      inviteTtlMinutes: 10,
    });
    await respondChallenge(a.id, challenge.id, "accept");
    await setChallengeReady(b.id, challenge.id, { ready: true });
    const started = await setChallengeReady(a.id, challenge.id, { ready: true });
    expect(started.status).toBe("started");
    const seatA = await getBattleView(a.id, started.battleId!);
    expect(seatA.online?.myDeadline).toBeNull();
    const ended = await forfeitBattle(a.id, seatA.id, { clientActionId: crypto.randomUUID(), revision: seatA.revision });
    expect(ended.view).toMatchObject({ status: "finished", result: "loss", endReason: "forfeit" });
    const lobbyB = await getChallenge(b.id, challenge.id);
    const seatB = await getBattleView(b.id, lobbyB.battleId!);
    expect(seatB).toMatchObject({ status: "finished", result: "win", endReason: "forfeit" });

    const open = await createChallenge(a.id, { clientRequestId: crypto.randomUUID(), opponentId: b.id, formatId: "gen9ou", timerSeconds: 120, ouTeamSource: "saved_or_random", inviteTtlMinutes: 5 });
    await removeFriend(b.id, a.id);
    expect((await getChallenge(a.id, open.id)).status).toBe("cancelled");
    expect((await getFriendsOverview(a.id)).friends).toHaveLength(0);
  }, 240_000);
});
