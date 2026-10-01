import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { BattleView, ChallengeResponse, GetBattleResponse, RandomTeamResponse, TeamResponse } from "../../src/shared/contract/index.ts";
import { api, assertLayoutAndAssets, choiceFor, loadEnvironment, login } from "../support/real-backend.ts";

/**
 * Two real accounts in two isolated browser contexts, against the real backend (Supabase Auth,
 * PostgreSQL, Realtime and Showdown). The temporary users are created here and deleted at the end.
 */

interface Player {
  name: string;
  email: string;
  password: string;
  userId: string;
  context: BrowserContext;
  page: Page;
  errors: string[];
}

const suffix = crypto.randomUUID().slice(0, 6);
const ASH = `Ash ${suffix}`;
const MISTY = `Misty ${suffix}`;
let a: Player;
let b: Player;

function admin() {
  const { url, secretKey } = loadEnvironment();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function newPlayer(browser: Browser, info: TestInfo, name: string): Promise<Player> {
  const email = `online-e2e+${crypto.randomUUID()}@pokeshowdown.test`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use;
  const context = await browser.newContext({
    viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL,
    storageState: { cookies: [], origins: [] },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, { email, password });
  return { name, email, password, userId: created.data.user.id, context, page, errors };
}

async function shot(page: Page, info: TestInfo, name: string) {
  await assertLayoutAndAssets(page);
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await info.attach(name, { path: file, contentType: "image/png" });
}

async function seat(request: APIRequestContext, id: string): Promise<BattleView> {
  return (await api<GetBattleResponse>(request, "get", `/api/battles/${id}`)).view;
}

/** Submits a legal choice; tolerates the 409/422 that a concurrent resolution can legitimately return. */
async function choose(request: APIRequestContext, view: BattleView) {
  const response = await request.post(`/api/battles/${view.id}/actions`, {
    data: { clientActionId: crypto.randomUUID(), revision: view.revision, choice: choiceFor(view) },
  });
  expect([200, 409, 422], await response.text()).toContain(response.status());
}

async function playToEnd(idA: string, idB: string): Promise<[BattleView, BattleView]> {
  for (let step = 0; step < 800; step += 1) {
    const [viewA, viewB] = await Promise.all([seat(a.page.request, idA), seat(b.page.request, idB)]);
    if (viewA.status === "finished" && viewB.status === "finished") return [viewA, viewB];
    const jobs: Promise<void>[] = [];
    if (viewA.status === "active" && viewA.online?.myPending) jobs.push(choose(a.page.request, viewA));
    if (viewB.status === "active" && viewB.online?.myPending) jobs.push(choose(b.page.request, viewB));
    await Promise.all(jobs);
  }
  throw new Error("online battle did not finish");
}

function headlineFor(result: BattleView["result"]) {
  return result === "win" ? "¡VICTORIA!" : result === "tie" ? "EMPATE" : "DERROTA";
}

test.describe.serial("Amigos y combate online entre dos cuentas reales", () => {
  test.beforeAll(async ({ browser }, info) => {
    [a, b] = await Promise.all([newPlayer(browser, info, ASH), newPlayer(browser, info, MISTY)]);
  });

  test.afterAll(async () => {
    await a?.context.close();
    await b?.context.close();
    const client = admin();
    const ids = [a?.userId, b?.userId].filter(Boolean) as string[];
    const matches = await client.from("online_matches").select("id").or(ids.map((id) => `p1_user_id.eq.${id},p2_user_id.eq.${id}`).join(","));
    for (const id of ids) await client.auth.admin.deleteUser(id);
    const matchIds = (matches.data ?? []).map((row: { id: string }) => row.id);
    if (matchIds.length > 0) await client.from("online_matches").delete().in("id", matchIds).is("p1_user_id", null).is("p2_user_id", null);
  });

  test("código de amigo, errores, solicitud y aceptación con notificación en otra sección", async ({}, info) => {
    await a.page.goto("/friends");
    const codeNode = a.page.getByTestId("my-friend-code");
    await expect(codeNode).toBeVisible();
    const code = (await codeNode.getAttribute("data-code")) ?? "";
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    await a.page.getByRole("button", { name: "Copiar mi código de amigo" }).click();
    await expect.poll(() => a.page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await shot(a.page, info, "01-friends-empty");

    // Errors: own code and an unknown code.
    await a.page.getByLabel("Añadir por código").fill(code);
    await a.page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(a.page.getByText("Ese es tu propio código")).toBeVisible();
    await b.page.goto("/friends");
    await b.page.getByLabel("Añadir por código").fill("2222-2222");
    await b.page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(b.page.getByText("No existe ningún entrenador con ese código")).toBeVisible();

    // B adds A while A browses Teams: A gets an in-app notification and accepts it there.
    await a.page.goto("/teams");
    await b.page.getByLabel("Añadir por código").fill(`${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase());
    await b.page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(b.page.getByText("Solicitud enviada.")).toBeVisible();
    await expect(b.page.getByTestId("outgoing-request")).toContainText(ASH);
    const card = a.page.locator("div[role='status']").filter({ hasText: `${MISTY} quiere ser tu amigo` });
    await expect(card).toBeVisible();
    await shot(a.page, info, "02-friend-request-notification");
    await card.getByRole("button", { name: "Aceptar" }).click();
    await expect(a.page.getByText(`${MISTY} ya es tu amigo.`)).toBeVisible();

    await expect(b.page.locator(`[data-testid='friend-row'][data-friend-name='${ASH}']`)).toBeVisible();
    await a.page.goto("/friends");
    const row = a.page.locator(`[data-testid='friend-row'][data-friend-name='${MISTY}']`);
    await expect(row).toBeVisible();
    await expect(row).toContainText("En línea");
    await shot(a.page, info, "03-friends-list");
  });

  test("desafío Gen 9 OU configurado por el anfitrión, equipos, Ready y combate completo", async ({}, info) => {
    // A needs a saved legal OU team; B will use a random legal one (allowed by the host).
    const random = await api<RandomTeamResponse>(a.page.request, "post", "/api/teams/random", { formatId: "gen9ou" });
    const saved = await api<TeamResponse>(a.page.request, "post", "/api/teams", { name: `Online ${suffix}`, formatId: "gen9ou", sets: random.sets });
    expect(saved.validation.valid).toBe(true);

    await a.page.goto("/friends");
    await a.page.locator(`[data-testid='friend-row'][data-friend-name='${MISTY}']`).getByRole("button", { name: "Desafiar" }).click();
    const modal = a.page.getByRole("dialog", { name: `Desafiar a ${MISTY}` });
    await modal.getByRole("radio", { name: "Gen 9 OU" }).click();
    await modal.getByRole("radio", { name: "120 s" }).click();
    await modal.getByRole("radio", { name: "Guardado o aleatorio" }).click();
    await modal.getByRole("radio", { name: "5 min" }).click();
    await shot(a.page, info, "04-challenge-config");
    await b.page.goto("/history");
    await modal.getByRole("button", { name: "Enviar desafío" }).click();

    // B, browsing History, receives the invitation in real time with every detail.
    const invite = b.page.getByRole("alertdialog", { name: `Desafío de ${ASH}` });
    await expect(invite).toBeVisible();
    await expect(invite).toContainText("Gen 9 OU · 120 s por decisión · Guardado o aleatorio");
    await expect(invite).toContainText("Caduca en");
    await shot(b.page, info, "05-challenge-notification");
    await invite.getByRole("button", { name: "Aceptar" }).click();
    await expect(b.page).toHaveURL(/\/challenge\//);
    const challengeId = b.page.url().split("/challenge/")[1]!;

    // A is taken to the lobby automatically; the rules are read-only for both.
    await expect(a.page).toHaveURL(`/challenge/${challengeId}`);
    for (const page of [a.page, b.page]) {
      const config = page.getByTestId("challenge-config");
      await expect(config).toContainText("Gen 9 OU");
      await expect(config).toContainText("120 s por decisión");
      await expect(config).toContainText("Equipo guardado o aleatorio");
    }
    const tamper = await b.page.request.post(`/api/challenges/${challengeId}/accept`, { data: {} });
    expect(tamper.status()).toBe(409);

    await a.page.getByRole("button", { name: saved.team.name }).click();
    await a.page.getByRole("button", { name: "¡Listo!" }).click();
    await expect(a.page.getByTestId("waiting-rival")).toContainText(`Esperando a ${MISTY}`);
    await expect(b.page.getByTestId("lobby-rival")).toHaveAttribute("data-ready", "true");
    await shot(b.page, info, "06-lobby");
    await b.page.getByRole("radio", { name: "Aleatorio" }).click();
    await b.page.getByRole("button", { name: "¡Listo!" }).click();

    await expect(a.page).toHaveURL(/\/battle\//);
    await expect(b.page).toHaveURL(/\/battle\//);
    const idA = a.page.url().split("/battle/")[1]!;
    const idB = b.page.url().split("/battle/")[1]!;
    expect(idA).not.toBe(idB);

    // Official Team Preview on both seats through the UI.
    for (const player of [a, b]) {
      const view = await seat(player.page.request, player === a ? idA : idB);
      expect(view.request?.kind).toBe("teamPreview");
      const lead = view.state.sides.p1.team[0]!;
      await player.page.getByRole("button", { name: new RegExp(`^${lead.name}`) }).click();
      await player.page.getByRole("button", { name: "Confirmar liderato", exact: true }).click();
    }
    await expect(a.page.getByTestId("online-rival")).toContainText(MISTY);
    await expect(a.page.getByRole("button", { name: "Luchar", exact: true })).toBeVisible();
    await expect(b.page.getByRole("button", { name: "Luchar", exact: true })).toBeVisible();
    await expect(a.page.getByRole("timer")).toContainText("Tú");
    await shot(a.page, info, "07-online-battle");

    // First turn via UI: A waits for B, then B's choice resolves it on both screens.
    await a.page.getByRole("button", { name: "Luchar", exact: true }).click();
    const viewA = await seat(a.page.request, idA);
    const move = viewA.request!.moves.find((entry) => !entry.disabled)!;
    await a.page.getByRole("button", { name: move.name, exact: true }).click();
    await expect(a.page.getByText(`Esperando a ${MISTY}…`)).toBeVisible();
    await shot(a.page, info, "08-waiting-rival");
    await b.page.getByRole("button", { name: "Luchar", exact: true }).click();
    const viewB = await seat(b.page.request, idB);
    await b.page.getByRole("button", { name: viewB.request!.moves.find((entry) => !entry.disabled)!.name, exact: true }).click();
    await expect.poll(async () => (await seat(a.page.request, idA)).revision).toBeGreaterThan(viewA.revision);

    const [endA, endB] = await playToEnd(idA, idB);
    expect(endA.endReason).toBe("normal");
    const expectedB = endA.result === "win" ? "loss" : endA.result === "loss" ? "win" : "tie";
    expect(endB.result).toBe(expectedB);
    await expect(a.page.getByRole("heading", { name: headlineFor(endA.result) })).toBeVisible({ timeout: 120_000 });
    await expect(b.page.getByRole("heading", { name: headlineFor(endB.result) })).toBeVisible({ timeout: 120_000 });
    await shot(a.page, info, "09-online-end");

    // Result and replay are stored for both players.
    await a.page.goto("/history");
    await expect(a.page.getByText(`Online vs ${MISTY}`).first()).toBeVisible();
    await b.page.goto("/history");
    await expect(b.page.getByText(`Online vs ${ASH}`).first()).toBeVisible();
    await shot(b.page, info, "10-history");
    expect((await b.page.request.get(`/api/replays/${idA}`)).status()).toBe(404);
    expect((await a.page.request.get(`/api/replays/${idA}`)).status()).toBe(200);
    expect((await b.page.request.get(`/api/battles/${idA}`)).status()).toBe(404);
  });

  test("Random Battle: desconexión, reconexión sin pausar el temporizador y derrota por tiempo", async ({}, info) => {
    const created = await api<ChallengeResponse>(a.page.request, "post", "/api/challenges", {
      clientRequestId: crypto.randomUUID(),
      opponentId: b.userId,
      formatId: "gen9randombattle",
      timerSeconds: 60,
      ouTeamSource: "saved",
      inviteTtlMinutes: 2,
    });
    const challengeId = created.challenge.id;

    // Simultaneous challenge from B is rejected and points to the open one.
    const crossed = await b.page.request.post("/api/challenges", {
      data: { clientRequestId: crypto.randomUUID(), opponentId: a.userId, formatId: "gen9ou", timerSeconds: null, ouTeamSource: "saved", inviteTtlMinutes: 5 },
    });
    expect(crossed.status()).toBe(409);
    expect((await crossed.json()).challengeId).toBe(challengeId);

    await b.page.goto(`/challenge/${challengeId}`);
    await b.page.getByRole("button", { name: "Aceptar desafío" }).click();
    await expect(a.page).toHaveURL(`/challenge/${challengeId}`);
    await a.page.getByRole("button", { name: "¡Listo!" }).click();
    await b.page.getByRole("button", { name: "¡Listo!" }).click();
    await expect(a.page).toHaveURL(/\/battle\//);
    await expect(b.page).toHaveURL(/\/battle\//);
    const idA = a.page.url().split("/battle/")[1]!;
    const idB = b.page.url().split("/battle/")[1]!;

    // B disconnects (closes the tab). A chooses and waits; B's clock keeps running.
    await b.page.close();
    let viewA = await seat(a.page.request, idA);
    if (viewA.online?.myPending) await choose(a.page.request, viewA);
    await expect(a.page.getByTestId("online-rival")).toBeVisible();
    await expect(a.page.getByRole("timer")).toContainText("Rival", { timeout: 15_000 });
    const beforeReconnect = (await seat(a.page.request, idA)).online!.opponentDeadline;

    // Reconnection: a new tab resumes the same seat and the same deadline.
    b.page = await b.context.newPage();
    await b.page.goto(`/battle/${idB}`);
    const viewB = await seat(b.page.request, idB);
    expect(viewB.online?.myDeadline).toBe(beforeReconnect);
    await expect(b.page.getByRole("timer")).toContainText("Tú");
    await shot(b.page, info, "11-reconnected");
    await choose(b.page.request, viewB);
    // A's open page receives the resolved turn without reloading.
    await expect.poll(async () => (await seat(a.page.request, idA)).revision, { timeout: 30_000 }).toBeGreaterThan(viewA.revision);
    await expect(a.page.getByRole("timer")).toContainText("Tú", { timeout: 30_000 });

    // B disconnects again and lets the 60 s timer run out while A is waiting.
    await b.page.close();
    viewA = await seat(a.page.request, idA);
    if (viewA.online?.myPending) await choose(a.page.request, viewA);
    await expect(a.page.getByRole("heading", { name: "¡VICTORIA!" })).toBeVisible({ timeout: 150_000 });
    await expect(a.page.getByTestId("end-reason")).toContainText(`A ${MISTY} se le acabó el tiempo`);
    await shot(a.page, info, "12-timeout-win");

    b.page = await b.context.newPage();
    await b.page.goto(`/battle/${idB}`);
    await expect(b.page.getByRole("heading", { name: "DERROTA" })).toBeVisible();
    await expect(b.page.getByTestId("end-reason")).toContainText("Se te acabó el tiempo");
    const finalB = await seat(b.page.request, idB);
    expect(finalB).toMatchObject({ status: "finished", result: "loss", endReason: "timeout" });

    // Removing the friend leaves the list empty for both.
    await a.page.goto("/friends");
    await a.page.locator(`[data-testid='friend-row'][data-friend-name='${MISTY}']`).getByRole("button", { name: `Eliminar a ${MISTY}` }).click();
    await a.page.getByRole("dialog", { name: "Eliminar amigo" }).getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(a.page.getByText("Aún no tienes amigos")).toBeVisible();
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
  });
});
