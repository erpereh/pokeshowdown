import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { ActionResponse, BattleView, PlayerChoice, PokemonSetData } from "../../src/shared/contract/index.ts";

export const authFile = path.resolve("test-results/real-auth.json");
export const credentialsFile = path.resolve("test-results/real-user.json");

export function loadEnvironment() {
  if (!process.env.SUPABASE_SECRET_KEY) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !secretKey) throw new Error("E2E requires the real Supabase environment in .env.local");
  return { url, publicKey, secretKey };
}

export async function createDedicatedUser() {
  const { url, secretKey } = loadEnvironment();
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `pve-e2e+${crypto.randomUUID()}@pokeshowdown.test`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "PvE QA" } });
  if (created.error || !created.data.user) throw new Error(`Cannot create dedicated QA user: ${created.error?.message ?? "missing user"}`);
  await mkdir(path.dirname(credentialsFile), { recursive: true });
  const credentials = { email, password, userId: created.data.user.id };
  await writeFile(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });
  return credentials;
}

export async function login(page: Page, credentials?: { email: string; password: string }) {
  const account = credentials ?? JSON.parse(await readFile(credentialsFile, "utf8")) as { email: string; password: string };
  await page.goto("/auth?next=/play");
  await page.getByLabel("Correo", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect.poll(async () => (await page.request.get("/api/teams")).status()).toBe(200);
  await expect.poll(async () => (await page.context().cookies()).filter((cookie) => cookie.name.includes("auth-token")).length).toBeGreaterThan(0);
}

export async function api<T>(request: APIRequestContext, method: "get" | "post", url: string, data?: unknown): Promise<T> {
  const response = method === "get" ? await request.get(url) : await request.post(url, { data });
  const body: unknown = await response.json();
  expect(response.ok(), `${method.toUpperCase()} ${url}: ${JSON.stringify(body)}`).toBe(true);
  return body as T;
}

export async function importSets(request: APIRequestContext, text: string): Promise<PokemonSetData[]> {
  return (await api<{ sets: PokemonSetData[] }>(request, "post", "/api/teams/import", { text })).sets;
}

export const REVIVAL_TEAM = `Forretress
Ability: Sturdy
Level: 1
Tera Type: Bug
- Explosion

Pawmot
Ability: Volt Absorb
Tera Type: Electric
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Revival Blessing
- Thunder Punch
- Close Combat
- Double Shock
`;

export const PASSIVE_TEAM = `Magikarp
Ability: Swift Swim
Tera Type: Water
EVs: 1 HP
- Splash
`;

const TYPE_IMMUNITIES: Readonly<Record<string, readonly string[]>> = {
  Normal: ["Ghost"], Fighting: ["Ghost"], Electric: ["Ground"], Ground: ["Flying"], Psychic: ["Dark"], Ghost: ["Normal"], Dragon: ["Fairy"], Poison: ["Steel"],
};

export function choiceFor(view: BattleView): PlayerChoice {
  const request = view.request;
  if (!request || request.kind === "wait") throw new Error("Active battle has no actionable player request");
  if (request.kind === "teamPreview") return { kind: "teamPreview", order: Array.from({ length: request.teamPreviewSize }, (_, i) => i + 1) };
  if (request.kind === "switch") {
    const candidate = request.switches.find((entry) => !entry.disabled);
    if (!candidate) throw new Error("Forced switch has no legal option");
    return { kind: "switch", slot: candidate.slot };
  }
  const foeTypes = view.state.sides.p2.active?.types ?? [];
  const moves = request.moves.filter((move) => !move.disabled);
  const ordered = [...moves].sort((a, b) => {
    const score = (move: typeof a) => {
      const immune = TYPE_IMMUNITIES[move.type]?.some((type) => foeTypes.includes(type));
      return immune ? -1 : move.basePower * (move.accuracy === true ? 1 : move.accuracy / 100) + (move.priority > 0 ? 2 : 0);
    };
    return score(b) - score(a);
  });
  // Rotate after long encounters so unrevealed abilities/immunities cannot trap the runner.
  const move = view.turn % 7 === 0 ? moves[view.turn % Math.max(moves.length, 1)] : ordered[0];
  if (!move) throw new Error("Move request has no legal option");
  return { kind: "move", slot: move.slot, terastallize: request.canTerastallize !== null || undefined };
}

export async function finishBattle(request: APIRequestContext, initial: BattleView): Promise<BattleView> {
  let view = initial;
  for (let action = 0; action < 240 && view.status === "active"; action += 1) {
    const result = await api<ActionResponse>(request, "post", `/api/battles/${view.id}/actions`, {
      clientActionId: crypto.randomUUID(), revision: view.revision, choice: choiceFor(view),
    });
    expect(result.view.revision).toBeGreaterThan(view.revision);
    view = result.view;
  }
  expect(view.status, `battle ${view.id}, turn ${view.turn}`).toBe("finished");
  expect(view.endReason).toBe("normal");
  expect(view.frames.some((frame) => frame.events.some((event) => event.kind === "win"))).toBe(true);
  return view;
}

export async function assertLayoutAndAssets(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => [...document.images].filter((img) => img.getAttribute("src") && (!img.complete || img.naturalWidth === 0)).map((img) => img.getAttribute("src")))).toEqual([]);
}

/**
 * Signs in against Supabase from Node and returns the exact SSR auth cookies the app would set,
 * so a remote deployment can be tested without typing credentials into its login form.
 */
export async function sessionCookies(baseURL: string, credentials: { email: string; password: string }) {
  const { url, publicKey } = loadEnvironment();
  const jar = new Map<string, string>();
  const client = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) jar.set(cookie.name, cookie.value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword(credentials);
  if (error) throw new Error(`Cannot sign in QA user: ${error.message}`);
  const { hostname, protocol } = new URL(baseURL);
  return [...jar].map(([name, value]) => ({
    name, value, domain: hostname, path: "/", httpOnly: false, secure: protocol === "https:", sameSite: "Lax" as const,
  }));
}
