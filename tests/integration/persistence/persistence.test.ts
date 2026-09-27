import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { backgroundForBattle, OUTDOOR_BACKGROUNDS } from "@/server/persistence/backgrounds.ts";
import { createAdminSupabase, type DbClient } from "@/server/supabase/admin.ts";
import type { Database } from "@/server/supabase/database.types.ts";

process.loadEnvFile?.(".env.local");

type UserClient = SupabaseClient<Database>;

const initialState = {
  turn: 0,
  field: { weather: null, terrain: null, pseudoWeather: [] },
  sides: {
    p1: {
      id: "p1",
      name: "Ada",
      teamSize: 6,
      active: null,
      team: [],
      conditions: [],
      canTerastallize: false,
    },
    p2: {
      id: "p2",
      name: "CPU",
      teamSize: 6,
      active: null,
      team: [],
      conditions: [],
      canTerastallize: false,
    },
  },
};

function frame(index: number) {
  return { index, events: [], state: { ...initialState, turn: index } };
}

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("persistence", () => {
  let admin: DbClient;
  let userAId = "";
  let userBId = "";
  let clientA: UserClient;
  let clientB: UserClient;
  let teamId = "";
  let battleId = "";

  beforeAll(async () => {
    admin = createAdminSupabase();
    const passwordA = `${crypto.randomUUID()}Aa1!`;
    const passwordB = `${crypto.randomUUID()}Aa1!`;
    const emailA = `e2e+${crypto.randomUUID()}@pokeshowdown.test`;
    const emailB = `e2e+${crypto.randomUUID()}@pokeshowdown.test`;

    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
      user_metadata: { display_name: "Ada" },
    });
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user) throw createdA.error ?? new Error("user A");
    if (createdB.error || !createdB.data.user) throw createdB.error ?? new Error("user B");
    userAId = createdA.data.user.id;
    userBId = createdB.data.user.id;

    clientA = signedInClient();
    clientB = signedInClient();
    const signA = await clientA.auth.signInWithPassword({ email: emailA, password: passwordA });
    const signB = await clientB.auth.signInWithPassword({ email: emailB, password: passwordB });
    if (signA.error || signB.error) throw signA.error ?? signB.error;
  }, 60_000);

  // Dedicated test users and their records are retained: validation never deletes remote data.

  it("creates a profile from display_name or the email prefix", async () => {
    const { data, error } = await admin.from("profiles").select("display_name").eq("user_id", userAId).single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe("Ada");

    const other = await admin.from("profiles").select("display_name").eq("user_id", userBId).single();
    expect(other.error).toBeNull();
    expect(other.data?.display_name.startsWith("e2e+")).toBe(true);
    expect(other.data?.display_name.length).toBeLessThanOrEqual(32);
  });

  it("isolates teams, battles, replays and secrets with RLS", async () => {
    const inserted = await admin
      .from("teams")
      .insert({
        owner_id: userAId,
        name: "Equipo A",
        format_id: "gen9ou",
        packed_team: "Pikachu",
        valid: false,
        engine_version: "0.11.11",
      })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();
    teamId = inserted.data?.id ?? "";

    const directWrite = await clientA.from("teams").insert({
      owner_id: userAId,
      name: "Directo",
      format_id: "gen9ou",
      packed_team: "Pikachu",
      valid: true,
      engine_version: "0.11.11",
    });
    expect(directWrite.error).not.toBeNull();

    const oversized = await admin.from("teams").insert({
      owner_id: userAId,
      name: "Grande",
      format_id: "gen9ou",
      packed_team: "x".repeat(8193),
      valid: false,
      engine_version: "0.11.11",
    });
    expect(oversized.error).not.toBeNull();

    const { getTeam, listTeams } = await import("@/server/persistence/teams.ts");
    const ownList = await listTeams(clientA, userAId);
    expect(ownList.some((team) => team.id === teamId)).toBe(true);
    const foreignList = await listTeams(clientB, userBId);
    expect(foreignList.some((team) => team.id === teamId)).toBe(false);
    const loaded = await getTeam(clientA, userAId, teamId);
    expect(loaded.team.name).toBe("Equipo A");
    await expect(getTeam(clientB, userBId, teamId)).rejects.toMatchObject({ status: 404, code: "not_found" });

    const hidden = await clientB.from("teams").select("id").eq("id", teamId);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);

    const visible = await clientA.from("teams").select("id").eq("id", teamId);
    expect(visible.data).toHaveLength(1);

    const profileInsert = await clientA.from("profiles").insert({ user_id: userAId, display_name: "Otro" });
    expect(profileInsert.error).not.toBeNull();
    const renamed = await clientA.from("profiles").update({ display_name: "Ada2" }).eq("user_id", userAId).select("display_name").single();
    expect(renamed.error).toBeNull();
    expect(renamed.data?.display_name).toBe("Ada2");
    await clientA.from("profiles").update({ display_name: "Ada" }).eq("user_id", userAId);

    const foreignProfile = await clientB.from("profiles").select("user_id").eq("user_id", userAId);
    expect(foreignProfile.error).toBeNull();
    expect(foreignProfile.data).toEqual([]);

    battleId = await insertBattle(userAId, crypto.randomUUID());
    const otherBattle = await clientB.from("battles").select("id").eq("id", battleId);
    expect(otherBattle.error).toBeNull();
    expect(otherBattle.data).toEqual([]);
    const ownBattle = await clientA.from("battles").select("id, revision").eq("id", battleId).single();
    expect(ownBattle.data?.revision).toBe(1);

    const anonymous = anonymousClient();
    for (const table of ["profiles", "teams", "battles", "battle_actions", "battle_replays"] as const) {
      const publicRows = await anonymous.from(table).select("*");
      expect(publicRows.data ?? []).toEqual([]);
    }
    const anonymousSecrets = await anonymous.from("battle_secrets").select("*");
    expect(anonymousSecrets.error).not.toBeNull();

    const secrets = await clientA.from("battle_secrets").select("seed").eq("battle_id", battleId);
    expect(secrets.error).not.toBeNull();
    expect(secrets.data).toBeNull();

    const denied = await clientA.rpc("commit_battle_turn", commitArgs(battleId, userAId, 1, crypto.randomUUID()));
    expect(denied.error).not.toBeNull();

    const insertBattleDenied = await clientA.from("battles").insert({
      owner_id: userAId,
      format_id: "gen9ou",
      engine_version: "0.11.11",
      status: "active",
      turn: 0,
      revision: 1,
      background: "bg-beach.jpg",
      player_name: "Ada",
      cpu_name: "CPU",
      initial_state: initialState,
      create_request_id: crypto.randomUUID(),
    });
    expect(insertBattleDenied.error).not.toBeNull();
  });

  it("builds the owner battle view from the persisted row", async () => {
    const { getBattleView, listBattles } = await import("@/server/persistence/battles.ts");
    const view = await getBattleView(userAId, battleId);
    expect(view.revision).toBe(1);
    expect(view.request?.rqid).toBe(1);
    expect(view.playerName).toBe("Ada");
    expect(view.cpuName).toBe("CPU");
    expect(view.background.endsWith(".jpg")).toBe(true);
    expect(view.frames[0]?.index).toBe(0);
    expect(view.state).toEqual(view.frames[0]?.state);
    await expect(getBattleView(userBId, battleId)).rejects.toMatchObject({ status: 404, code: "not_found" });
    const listed = await listBattles(userAId, "active");
    expect(listed.some((battle) => battle.id === battleId)).toBe(true);
    const hidden = await listBattles(userBId);
    expect(hidden.some((battle) => battle.id === battleId)).toBe(false);
  });

  it("rejects a stale revision and replays a duplicate client request id", async () => {
    const stale = await admin.rpc("commit_battle_turn", commitArgs(battleId, userAId, 99, crypto.randomUUID()));
    expect(stale.error?.code).toBe("P0004");
    await expectRevision(1);

    const clientActionId = crypto.randomUUID();
    const committed = await admin.rpc("commit_battle_turn", commitArgs(battleId, userAId, 1, clientActionId));
    expect(committed.error).toBeNull();
    await expectRevision(2);

    const duplicate = await admin.rpc("commit_battle_turn", commitArgs(battleId, userAId, 1, clientActionId));
    expect(duplicate.error?.code).toBe("P0004");
    await expectRevision(2);

    const otherClient = await admin.rpc("commit_battle_turn", commitArgs(battleId, userAId, 1, crypto.randomUUID()));
    expect(otherClient.error?.code).toBe("P0004");
    await expectRevision(2);

    const conflictBattleId = await insertBattle(userAId, crypto.randomUUID());
    const plantedId = crypto.randomUUID();
    const planted = await admin.from("battle_actions").insert({
      battle_id: conflictBattleId,
      client_request_id: plantedId,
      kind: "choice",
      revision_before: 1,
      p1_choice: { kind: "move", slot: 1 },
    });
    expect(planted.error).toBeNull();
    const conflict = await admin.rpc("commit_battle_turn", commitArgs(conflictBattleId, userAId, 1, plantedId));
    expect(conflict.error?.code).toBe("23505");
    await expectRevision(2);

    const actions = await admin.from("battle_actions").select("id").eq("battle_id", battleId);
    expect(actions.data).toHaveLength(1);
  });

  it("returns the same battle when create_request_id is repeated", async () => {
    const requestId = crypto.randomUUID();
    const first = await insertBattle(userAId, requestId);
    const second = await insertBattle(userAId, requestId);
    expect(second).toBe(first);
    const rows = await admin.from("battles").select("id").eq("owner_id", userAId).eq("create_request_id", requestId);
    expect(rows.data).toHaveLength(1);
  });

  it("preserves a finished battle and isolates its immutable replay", async () => {
    const finished = await admin.rpc(
      "commit_battle_turn",
      commitArgs(battleId, userAId, 2, crypto.randomUUID(), {
        kind: "forfeit",
        choice: null,
        status: "finished",
        winner: "p2",
        endReason: "forfeit",
        turn: 4,
      }),
    );
    expect(finished.error).toBeNull();

    const { getReplay } = await import("@/server/persistence/battles.ts");
    const stored = await getReplay(userAId, battleId);
    expect(stored.result).toBe("loss");
    expect(stored.battleId).toBe(battleId);
    expect(stored.endReason).toBe("forfeit");
    await expect(getReplay(userBId, battleId)).rejects.toMatchObject({ status: 404, code: "not_found" });

    const replay = await clientA.from("battle_replays").select("result, turns").eq("battle_id", battleId).single();
    expect(replay.data?.result).toBe("loss");
    expect(replay.data?.turns).toBe(4);
    const hiddenReplay = await clientB.from("battle_replays").select("battle_id").eq("battle_id", battleId);
    expect(hiddenReplay.error).toBeNull();
    expect(hiddenReplay.data).toEqual([]);

    const updated = await admin.from("battles").update({ turn: 99 }).eq("id", battleId);
    expect(updated.error?.code).toBe("P0003");
    const secrets = await admin.from("battle_secrets").update({ seed: "sodium,ff" }).eq("battle_id", battleId);
    expect(secrets.error?.code).toBe("P0003");
    const retained = await admin.from("battles").select("status").eq("id", battleId).single();
    expect(retained.data?.status).toBe("finished");
  });

  it("forfeits a battle from another engine version and rejects other actions", async () => {
    const id = await insertBattle(userAId, crypto.randomUUID(), "0.0.0");
    const { forfeitBattle, submitAction } = await import("@/server/persistence/battles.ts");
    await expect(
      submitAction(userAId, id, {
        clientActionId: crypto.randomUUID(),
        revision: 1,
        choice: { kind: "move", slot: 1 },
      }),
    ).rejects.toMatchObject({ status: 409, code: "engine_version_mismatch" });
    const active = await admin.from("battles").select("status").eq("id", id).single();
    expect(active.data?.status).toBe("active");

    const result = await forfeitBattle(userAId, id, { clientActionId: crypto.randomUUID(), revision: 1 });
    expect(result.replayed).toBe(false);
    expect(result.view.status).toBe("finished");
    expect(result.view.result).toBe("loss");
    expect(result.view.endReason).toBe("forfeit");
    expect(result.newFrames[0]?.events.some((event) => event.text === "Te has rendido.")).toBe(true);
    const secrets = await admin.from("battle_secrets").select("input_log").eq("battle_id", id).single();
    expect(secrets.data?.input_log).toContain(">forcelose p1");
  });

  it("rejects a reused client action id that carries a different choice", async () => {
    const id = await insertBattle(userAId, crypto.randomUUID(), "0.0.0");
    const clientActionId = crypto.randomUUID();
    const planted = await admin.from("battle_actions").insert({
      battle_id: id,
      client_request_id: clientActionId,
      kind: "choice",
      revision_before: 1,
      p1_choice: { kind: "move", slot: 1 },
    });
    expect(planted.error).toBeNull();
    const { submitAction } = await import("@/server/persistence/battles.ts");
    await expect(
      submitAction(userAId, id, { clientActionId, revision: 1, choice: { kind: "move", slot: 2 } }),
    ).rejects.toMatchObject({ status: 409 });
    const replayed = await submitAction(userAId, id, {
      clientActionId,
      revision: 1,
      choice: { kind: "move", slot: 1 },
    });
    expect(replayed.replayed).toBe(true);
    const row = await admin.from("battles").select("status, revision").eq("id", id).single();
    expect(row.data?.status).toBe("active");
    expect(row.data?.revision).toBe(1);
  });

  it("picks a stable outdoor background filename", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const name = backgroundForBattle(id);
    expect(name).toBe(backgroundForBattle(id));
    expect(OUTDOOR_BACKGROUNDS).toContain(name);
    expect(name.endsWith(".jpg")).toBe(true);
    expect(name.startsWith("bg-")).toBe(true);
  });

  async function expectRevision(revision: number) {
    const row = await admin.from("battles").select("revision").eq("id", battleId).single();
    expect(row.data?.revision).toBe(revision);
  }

  async function insertBattle(ownerId: string, requestId: string, engineVersion = "0.11.11"): Promise<string> {
    const id = crypto.randomUUID();
    const { data, error } = await admin.rpc("create_battle", {
      p_id: id,
      p_owner_id: ownerId,
      p_create_request_id: requestId,
      p_format_id: "gen9ou",
      p_engine_version: engineVersion,
      p_background: backgroundForBattle(id),
      p_player_name: "Ada",
      p_cpu_name: "CPU",
      p_turn: 0,
      p_p1_request: { rqid: 1, kind: "move", moves: [], switches: [], canTerastallize: null, trapped: false, reviving: false, teamPreviewSize: 6 },
      p_initial_state: initialState,
      p_frame: frame(0),
      p_seed: "sodium,0123456789abcdef0123456789abcdef",
      p_p1_team: "packed-p1",
      p_p2_team: "packed-p2",
      p_input_log: [">start"],
      p_checkpoint: { turn: 0, p1RequestRaw: "{}" },
      p_status: "active",
    });
    if (error || !data) throw error ?? new Error("create_battle");
    return data;
  }
});

function signedInClient(): UserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing publishable Supabase environment");
  return createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      storage: memoryStorage(),
    },
  });
}

function anonymousClient(): UserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing publishable Supabase environment");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function commitArgs(
  battleId: string,
  ownerId: string,
  revision: number,
  clientRequestId: string,
  overrides?: {
    kind: "choice" | "forfeit";
    choice: { kind: "move"; slot: number } | null;
    status: "active" | "finished";
    winner: string;
    endReason: string;
    turn: number;
  },
) {
  const status = overrides?.status ?? "active";
  return {
    p_battle_id: battleId,
    p_owner_id: ownerId,
    p_expected_revision: revision,
    p_client_request_id: clientRequestId,
    p_kind: overrides?.kind ?? "choice",
    p_p1_choice: overrides?.kind === "forfeit" ? null : { kind: "move", slot: 1 },
    p_input_log_delta: [">p1 move 1"],
    p_frame: frame(revision),
    p_p1_request: { rqid: revision + 1, kind: "wait" },
    p_checkpoint: { turn: overrides?.turn ?? 1, p1RequestRaw: null },
    p_turn: overrides?.turn ?? 1,
    p_status: status,
    p_winner: overrides?.winner ?? "p1",
    p_end_reason: overrides?.endReason ?? "normal",
  } as Database["public"]["Functions"]["commit_battle_turn"]["Args"];
}
