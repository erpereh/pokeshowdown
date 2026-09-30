import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ActionResponse, BattleView, GetBattleResponse, TeamResponse } from "../../src/shared/contract/index.ts";
import { api, assertLayoutAndAssets, authFile, choiceFor, finishBattle, importSets, loadEnvironment, login, PASSIVE_TEAM, REVIVAL_TEAM } from "../support/real-backend.ts";

async function screenshot(page: Page, info: TestInfo, name: string) {
  await assertLayoutAndAssets(page);
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(name, { path: file, contentType: "image/png" });
}

async function current(page: Page, id: string) {
  return (await api<GetBattleResponse>(page.request, "get", `/api/battles/${id}`)).view;
}

async function uiAction(page: Page, id: string, click: () => Promise<void>): Promise<ActionResponse> {
  const response = page.waitForResponse((r) => r.url().endsWith(`/api/battles/${id}/actions`) && r.request().method() === "POST");
  await click();
  const resolved = await response;
  const result: ActionResponse = await resolved.json();
  expect(resolved.ok(), JSON.stringify(result)).toBe(true);
  // Let real animation playback finish before interacting with its next request.
  await expect(page.getByText("Resolviendo turno…", { exact: true })).toBeHidden();
  return result;
}

test("Auth real, Team Builder, las cuatro combinaciones OU y Random oficial completan combates", async ({ page }, info) => {
  const errors: string[] = [];
  const badResponses: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await page.goto("/teams/new");
  await page.getByLabel("Nombre del equipo", { exact: true }).fill(`QA ${info.project.name}`);
  await page.getByText("Más opciones de equipo", { exact: true }).click();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page.getByLabel("Texto de Showdown", { exact: true }).fill(REVIVAL_TEAM);
  await page.getByRole("button", { name: "Sustituir equipo", exact: true }).click();
  const savedResponse = page.waitForResponse((r) => r.url().endsWith("/api/teams") && r.request().method() === "POST");
  await page.getByTestId("save-team").click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(201);
  const playerTeam: TeamResponse = await saved.json();
  expect(playerTeam.validation.valid, JSON.stringify(playerTeam.validation.problems)).toBe(true);
  await expect(page).toHaveURL(`/teams/${playerTeam.team.id}`);
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await screenshot(page, info, "01-team-builder");
  await page.getByText("Más opciones de equipo", { exact: true }).click();
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await expect(page.getByLabel("Texto del equipo", { exact: true })).toHaveValue(/Forretress/);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();

  const passive = await importSets(page.request, PASSIVE_TEAM);
  const cpuTeam = await api<TeamResponse>(page.request, "post", "/api/teams", { name: `CPU QA ${info.project.name}`, formatId: "gen9ou", sets: passive });
  expect(cpuTeam.validation.valid).toBe(true);
  const ids: string[] = [];
  const results: { id: string; format: string; player: string; cpu: string; turns: number; result: string | null }[] = [];
  for (const [playerMode, cpuMode] of [["saved", "saved"], ["saved", "random"], ["random", "saved"], ["random", "random"]] as const) {
    await page.goto("/play?format=gen9ou");
    const mobile = info.project.name.startsWith("mobile");
    const playerSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tu equipo", exact: true }) });
    const cpuSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Equipo de la CPU", exact: true }) });
    if (playerMode === "random") await playerSection.getByRole("radio", { name: "Aleatorio", exact: true }).click();
    else await playerSection.getByRole("button", { name: playerTeam.team.name, exact: true }).click();
    if (mobile) await page.getByRole("radio", { name: "Equipo de la CPU", exact: true }).click();
    await cpuSection.getByRole("radio", { name: cpuMode === "random" ? "Aleatorio" : "Guardado", exact: true }).click();
    if (cpuMode === "saved") await cpuSection.getByRole("button", { name: cpuTeam.team.name, exact: true }).click();
    if (playerMode === "random" && cpuMode === "random") await screenshot(page, info, "02-ou-setup");
    const createdResponse = page.waitForResponse((r) => r.url().endsWith("/api/battles") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Comenzar combate", exact: true }).click();
    const created = await createdResponse;
    const body: { view: BattleView } = await created.json();
    expect(created.status(), JSON.stringify(body)).toBe(201);
    let view = body.view;
    ids.push(view.id);
    await expect(page).toHaveURL(`/battle/${view.id}`);
    const lead = view.state.sides.p1.team[0];
    if (!lead) throw new Error("No player team in preview");
    await page.getByRole("button", { name: new RegExp(`^${lead.name}`) }).click();
    view = (await uiAction(page, view.id, () => page.getByRole("button", { name: "Confirmar liderato", exact: true }).click())).view;
    await screenshot(page, info, `03-${playerMode}-${cpuMode}-battle`);
    view = await finishBattle(page.request, view);
    results.push({ id: view.id, format: view.formatId, player: playerMode, cpu: cpuMode, turns: view.turn, result: view.result });
    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver repetición", exact: true })).toBeVisible();
    await screenshot(page, info, `04-${playerMode}-${cpuMode}-completed`);
  }

  await page.goto("/play?format=gen9randombattle");
  const started = page.waitForResponse((r) => r.url().endsWith("/api/battles") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Comenzar combate", exact: true }).click();
  const randomResponse = await started;
  const random: { view: BattleView } = await randomResponse.json();
  expect(randomResponse.status()).toBe(201);
  expect(random.view.formatId).toBe("gen9randombattle");
  expect(random.view.state.sides.p1.teamSize).toBe(6);
  expect(random.view.state.sides.p2.teamSize).toBe(6);
  expect(random.view.state.sides.p2.team).toHaveLength(1);
  const randomFinished = await finishBattle(page.request, random.view);
  ids.push(randomFinished.id);
  results.push({ id: randomFinished.id, format: randomFinished.formatId, player: "official-random", cpu: "official-random", turns: randomFinished.turn, result: randomFinished.result });
  await page.goto(`/replay/${randomFinished.id}`);
  await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await screenshot(page, info, "05-random-official-replay");
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausa", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  await page.goto("/history");
  for (const id of ids) await expect(page.locator(`a[href='/replay/${id}']`)).toBeVisible();
  await screenshot(page, info, "06-history");
  const resultFile = info.outputPath("battle-results.json");
  await writeFile(resultFile, JSON.stringify(results, null, 2));
  await info.attach("real-battle-results", { path: resultFile, contentType: "application/json" });
  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
});

test("Revival Blessing, cambio forzado, Tera, autosave, cerrar/reabrir y victoria real", async ({ page, browser }, info) => {
  const sets = await importSets(page.request, REVIVAL_TEAM);
  const cpuSets = await importSets(page.request, PASSIVE_TEAM);
  const { view: created } = await api<{ view: BattleView }>(page.request, "post", "/api/battles", {
    clientRequestId: crypto.randomUUID(), formatId: "gen9ou", player: { kind: "inline", sets }, cpu: { kind: "inline", sets: cpuSets },
  });
  await page.goto(`/battle/${created.id}`);
  await page.getByRole("button", { name: /^Forretress/ }).click();
  await uiAction(page, created.id, () => page.getByRole("button", { name: "Confirmar liderato", exact: true }).click());
  await page.getByRole("button", { name: "Luchar", exact: true }).click();
  let result = await uiAction(page, created.id, () => page.getByRole("button", { name: "Explosion", exact: true }).click());
  expect(result.view.request?.kind).toBe("switch");
  expect(result.view.state.sides.p1.team.find((mon) => mon.species === "Forretress")?.fainted).toBe(true);
  await screenshot(page, info, "07-forced-switch");
  result = await uiAction(page, created.id, () => page.getByRole("button", { name: /^Pawmot/ }).click());
  await page.getByRole("button", { name: "Luchar", exact: true }).click();
  result = await uiAction(page, created.id, () => page.getByRole("button", { name: "Revival Blessing", exact: true }).click());
  expect(result.view.request?.reviving).toBe(true);
  await screenshot(page, info, "08-revival-choice");
  result = await uiAction(page, created.id, () => page.getByRole("button", { name: /^Forretress/ }).click());
  const revived = result.view.state.sides.p1.team.find((mon) => mon.species === "Forretress");
  expect(revived?.fainted).toBe(false);
  expect(revived?.hp).toBeGreaterThan(0);
  expect(result.view.state.sides.p1.active?.species).toBe("Pawmot");
  expect(result.view.request?.kind).toBe("move");

  const persisted = await current(page, created.id);
  expect(persisted.revision).toBe(result.view.revision);
  expect(persisted.state).toEqual(result.view.state);
  const stateFile = info.outputPath("resume-auth.json");
  await page.context().storageState({ path: stateFile });
  await page.context().close();
  const reopenedContext = await browser.newContext({ ...info.project.use, storageState: stateFile });
  try {
    const reopened = await reopenedContext.newPage();
    await reopened.goto("/saved");
    await expect(reopened.locator(`a[href='/battle/${created.id}']`)).toBeVisible();
    await reopened.locator(`a[href='/battle/${created.id}']`).click();
    const reloaded = await current(reopened, created.id);
    expect(reloaded.revision).toBe(persisted.revision);
    expect(reloaded.state).toEqual(persisted.state);
    await screenshot(reopened, info, "09-resumed");
    await reopened.getByRole("button", { name: /Teracristalizar/ }).click();
    result = await uiAction(reopened, created.id, () => reopened.getByRole("button", { name: "Thunder Punch", exact: true }).click());
    expect(result.view.frames.some((frame) => frame.events.some((event) => event.kind === "terastallize" && event.pokemon.side === "p1"))).toBe(true);
    const finished = result.view.status === "finished" ? result.view : await finishBattle(reopened.request, result.view);
    expect(finished.result).toBe("win");
    await reopened.reload();
    await expect(reopened.getByRole("heading", { name: "¡VICTORIA!", exact: true })).toBeVisible();
    await screenshot(reopened, info, "10-victory");
    await reopened.getByRole("link", { name: "Ver repetición", exact: true }).click();
    await reopened.getByRole("slider", { name: "Turno de la repetición", exact: true }).fill(String(finished.turn));
    await screenshot(reopened, info, "11-revival-replay-end");
  } finally {
    await reopenedContext.close();
  }
});

test("API real conserva idempotencia, rechaza concurrencia obsoleta y rendición", async ({ page }, info) => {
  const id = crypto.randomUUID();
  const payload = { clientRequestId: id, formatId: "gen9randombattle", player: { kind: "random" }, cpu: { kind: "random" } };
  const first = await api<{ view: BattleView }>(page.request, "post", "/api/battles", payload);
  const repeated = await api<{ view: BattleView }>(page.request, "post", "/api/battles", payload);
  expect(repeated.view.id).toBe(first.view.id);
  const action = { clientActionId: crypto.randomUUID(), revision: first.view.revision, choice: choiceFor(first.view) };
  const concurrent = await Promise.all([page.request.post(`/api/battles/${first.view.id}/actions`, { data: action }), page.request.post(`/api/battles/${first.view.id}/actions`, { data: action })]);
  for (const response of concurrent) expect(response.status()).toBe(200);
  const responses: ActionResponse[] = await Promise.all(concurrent.map((response) => response.json() as Promise<ActionResponse>));
  expect(responses[0]?.view.revision).toBe(first.view.revision + 1);
  expect(responses[1]?.view.revision).toBe(first.view.revision + 1);
  const altered = await page.request.post(`/api/battles/${first.view.id}/actions`, { data: { ...action, choice: { kind: "switch", slot: 2 } } });
  expect(altered.status()).toBe(409);
  const stale = await page.request.post(`/api/battles/${first.view.id}/actions`, { data: { ...action, clientActionId: crypto.randomUUID() } });
  expect(stale.status()).toBe(409);
  const durable = await current(page, first.view.id);
  expect(durable.revision).toBe(first.view.revision + 1);
  await page.goto(`/battle/${first.view.id}`);
  await page.getByRole("button", { name: "Rendirse", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "¿Rendirse?", exact: true })).toBeVisible();
  const forfeited = page.waitForResponse((response) => response.url().endsWith(`/api/battles/${first.view.id}/forfeit`));
  await page.getByRole("dialog").getByRole("button", { name: "Rendirse", exact: true }).click();
  expect((await forfeited).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Te has rendido", exact: true })).toBeVisible();
  const finished = await current(page, first.view.id);
  expect(finished.endReason).toBe("forfeit");
  await screenshot(page, info, "12-forfeit");
  await mkdir(path.resolve("test-results"), { recursive: true });
  await writeFile(path.resolve(`test-results/verification-${info.project.name}.json`), JSON.stringify({ accountStorage: authFile, testedBattleId: first.view.id, revision: finished.revision, status: finished.status, endReason: finished.endReason }));
});

test("Rutas protegidas exigen Auth real", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: "http://localhost:3000" });
  try {
    const page = await context.newPage();
    await page.goto("/play");
    await expect(page).toHaveURL(/\/auth\?next=/);
    const response = await context.request.get("/api/battles");
    expect(response.status()).toBe(401);
  } finally {
    await context.close();
  }
});

test("Pérdida real de respuesta recupera el mismo turno con Reintentar", async ({ page }) => {
  const { view } = await api<{ view: BattleView }>(page.request, "post", "/api/battles", {
    clientRequestId: crypto.randomUUID(), formatId: "gen9randombattle", player: { kind: "random" }, cpu: { kind: "random" },
  });
  await page.goto(`/battle/${view.id}`);
  const move = view.request?.moves.find((candidate) => !candidate.disabled);
  if (!move) throw new Error("Random Battle must have a playable first request");
  const submissions: unknown[] = [];
  let dropped = false;
  await page.route(`**/api/battles/${view.id}/actions`, async (route) => {
    submissions.push(route.request().postDataJSON() as unknown);
    if (!dropped) {
      dropped = true;
      const persisted = await route.fetch();
      expect(persisted.status()).toBe(200);
      await route.abort("connectionreset");
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "Luchar", exact: true }).click();
  await page.getByRole("button", { name: move.name, exact: true }).click();
  await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
  const durable = await current(page, view.id);
  expect(durable.revision).toBe(view.revision + 1);
  const replayed = page.waitForResponse((response) => response.url().endsWith(`/api/battles/${view.id}/actions`));
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  const response = await replayed;
  const result: ActionResponse = await response.json();
  expect(response.status()).toBe(200);
  expect(result.replayed).toBe(true);
  expect(result.view.revision).toBe(durable.revision);
  expect(submissions).toHaveLength(2);
  expect(submissions[0]).toEqual(submissions[1]);
  expect((await current(page, view.id)).revision).toBe(durable.revision);
  await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeHidden();
});

test("Recuperación Auth verifica OTP real, cambia contraseña y permite acceso sin enviar correo", async ({ browser }, info) => {
  const { url, secretKey } = loadEnvironment();
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `pve-recovery+${crypto.randomUUID()}@pokeshowdown.test`;
  const oldPassword = `${crypto.randomUUID()}Aa1!`;
  const newPassword = `${crypto.randomUUID()}Bb2!`;
  const created = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true, user_metadata: { display_name: "PvE Recovery" } });
  expect(created.error).toBeNull();
  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
  expect(recovery.error).toBeNull();
  const token = recovery.data.properties?.hashed_token;
  if (!token) throw new Error("Supabase did not return a recovery OTP");
  const context = await browser.newContext({ ...info.project.use, storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery`);
    await expect(page).toHaveURL(/\/auth\/update-password$/);
    await page.getByLabel("Contraseña", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirmar contraseña", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
    await expect(page).toHaveURL(/\/play$/);
    await page.getByRole("button", { name: "Cuenta de PvE Recovery", exact: true }).click();
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(page.getByRole("link", { name: "Entrar", exact: true }).first()).toBeVisible();
    await login(page, { email, password: newPassword });
  } finally {
    await context.close();
  }
});
