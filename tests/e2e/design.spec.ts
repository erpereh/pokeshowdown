import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { api, assertLayoutAndAssets, importSets, PASSIVE_TEAM, REVIVAL_TEAM } from "../support/real-backend.ts";
import type { BattleView, GetBattleResponse } from "../../src/shared/contract/index.ts";

async function capture(page: Page, info: TestInfo, name: string) {
  await assertLayoutAndAssets(page);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: await page.getByRole("dialog").count() === 0 });
  await info.attach(name, { path, contentType: "image/png" });
}

test("Lobby, navegación y pantallas mantienen espacio táctil en móvil, tablet y desktop", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [768, 1024], [1280, 800]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    await expect(page).toHaveURL(/\/play$/);
    const nav = page.locator("nav[aria-label='Principal']:visible");
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Jugar", exact: true })).toHaveAttribute("aria-current", "page");
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
      expect(box?.width).toBeGreaterThanOrEqual(48);
    }
    await capture(page, info, `lobby-${width}`);
    await page.getByRole("button", { name: /Gen 9 Random Battle/ }).click();
    await capture(page, info, `setup-${width}`);
    const button = await page.getByRole("button", { name: "Comenzar combate", exact: true }).boundingBox();
    const tabs = width! < 1024 ? await nav.boundingBox() : null;
    expect(button).not.toBeNull();
    if (button && tabs) expect(button.y + button.height).toBeLessThanOrEqual(tabs.y);
  }
  for (const route of ["/friends", "/teams", "/saved", "/history"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await capture(page, info, route.slice(1));
  }
  expect(errors).toEqual([]);
});

test("Editor móvil conserva campos entre secciones y restaura el foco al cerrar", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teams/new");
  await page.getByLabel("Nombre del equipo", { exact: true }).fill("Borrador visual");
  await page.getByText("Más opciones de equipo", { exact: true }).click();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page.getByLabel("Texto de Showdown", { exact: true }).fill(REVIVAL_TEAM);
  await page.getByRole("button", { name: "Sustituir equipo", exact: true }).click();
  await page.locator("#slot-tab-0").click();
  const editor = page.getByTestId("set-editor");
  await editor.getByLabel("Apodo", { exact: true }).fill("Cristal");
  await editor.getByRole("radio", { name: "Set", exact: true }).click();
  await expect(editor.getByLabel("Tipo Tera", { exact: true })).toBeVisible();
  await capture(page, info, "editor-set");
  await editor.getByRole("radio", { name: "Entrenamiento", exact: true }).click();
  await editor.getByRole("spinbutton", { name: "Ataque EVs, valor numérico", exact: true }).fill("100");
  await capture(page, info, "editor-training");
  await editor.getByRole("radio", { name: "Pokémon", exact: true }).click();
  await expect(editor.getByLabel("Apodo", { exact: true })).toHaveValue("Cristal");
  await editor.getByRole("radio", { name: "Entrenamiento", exact: true }).click();
  await expect(editor.getByRole("spinbutton", { name: "Ataque EVs, valor numérico", exact: true })).toHaveValue("100");
  await page.getByRole("button", { name: "Volver a las ranuras", exact: true }).click();
  await expect(page.locator("#slot-tab-0")).toBeFocused();
});

test("Detalles de movimiento y registro se abren sin enviar turnos y el combate cabe en vertical y horizontal", async ({ page }, info) => {
  const sets = await importSets(page.request, REVIVAL_TEAM);
  const cpuSets = await importSets(page.request, PASSIVE_TEAM);
  const { view } = await api<{ view: BattleView }>(page.request, "post", "/api/battles", {
    clientRequestId: crypto.randomUUID(), formatId: "gen9ou", player: { kind: "inline", sets }, cpu: { kind: "inline", sets: cpuSets },
  });
  await page.goto(`/battle/${view.id}`);
  await page.getByRole("button", { name: /^Forretress/ }).click();
  const confirmed = page.waitForResponse((r) => r.url().endsWith(`/api/battles/${view.id}/actions`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirmar liderato", exact: true }).click();
  await confirmed;
  await page.getByRole("button", { name: "Luchar", exact: true }).click();
  const detail = page.getByRole("button", { name: "Detalles de Explosion", exact: true });
  await expect(detail).toBeVisible();
  const before = await api<GetBattleResponse>(page.request, "get", `/api/battles/${view.id}`);
  await detail.click();
  const sheet = page.getByRole("dialog", { name: "Explosion", exact: true });
  await expect(sheet.getByText("Precisión", { exact: true })).toBeVisible();
  await capture(page, info, "move-details");
  await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(detail).toBeFocused();
  const after = await api<GetBattleResponse>(page.request, "get", `/api/battles/${view.id}`);
  expect(after.view.revision).toBe(before.view.revision);
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator(".battle-arena")).toBeVisible();
    const arena = await page.locator(".battle-arena").boundingBox();
    expect(arena?.height).toBeGreaterThanOrEqual(150);
    await page.getByRole("button", { name: "Explosion", exact: true }).scrollIntoViewIfNeeded();
    await capture(page, info, `battle-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir registro del combate", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Registro", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir registro del combate", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await page.getByRole("button", { name: "Pokémon", exact: true }).click();
  const switched = page.waitForResponse((r) => r.url().endsWith(`/api/battles/${view.id}/actions`) && r.request().method() === "POST");
  await page.getByRole("button", { name: /^Pawmot/ }).click();
  expect((await switched).status()).toBe(200);
  await page.getByRole("button", { name: "Luchar", exact: true }).click();
  await expect(page.locator(".move-choice")).toHaveCount(4);
  for (const [width, height] of [[390, 844], [430, 932], [844, 390]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await capture(page, info, `four-moves-${width}`);
  }
});

test("Acceso y recuperación permanecen legibles en móvil y landscape", async ({ browser }, info) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  try {
    for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width: width!, height: height! });
      await page.goto("/auth");
      await expect(page.getByLabel("Correo", { exact: true })).toBeVisible();
      await capture(page, info, `auth-${width}`);
      await page.getByRole("button", { name: "He olvidado mi contraseña", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Recupera tu cuenta", exact: true })).toBeVisible();
      await capture(page, info, `recovery-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 470 });
    await page.goto("/auth");
    const password = page.getByLabel("Contraseña", { exact: true });
    await password.fill("prueba-de-teclado");
    await password.scrollIntoViewIfNeeded();
    const bounds = await password.boundingBox();
    const nav = await page.locator("nav[aria-label='Principal']:visible").boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds && nav) expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
    await capture(page, info, "auth-keyboard-height");
  } finally { await context.close(); }
});
