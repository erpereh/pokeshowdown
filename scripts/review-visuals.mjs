import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const cycle = process.argv[2] ?? "1";
if (!/^[1-3]$/.test(cycle)) throw new Error("Use visual review cycle 1, 2 or 3.");
const output = path.resolve("artifacts", "visual-review", `cycle-${cycle}`);
await mkdir(output, { recursive: true });
const visualAuthFile = path.resolve("artifacts", "visual-review", "auth.json");
let storageState;
try {
  storageState = JSON.parse(await readFile(visualAuthFile, "utf8"));
} catch {
  storageState = JSON.parse(await readFile("test-results/real-auth.json", "utf8"));
  await writeFile(visualAuthFile, JSON.stringify(storageState));
}
const browser = await chromium.launch();
const report = [];
try {
  const setup = await browser.newContext({ baseURL: "http://localhost:3000", storageState });
  const teamsResponse = await setup.request.get("/api/teams");
  if (!teamsResponse.ok()) throw new Error(`Auth/setup ${teamsResponse.status()}`);
  const { teams } = await teamsResponse.json();
  const finishedResponse = await setup.request.get("/api/battles?status=finished");
  const { battles: finished } = await finishedResponse.json();
  let battleId;
  try {
    ({ battleId } = JSON.parse(await readFile("artifacts/visual-review/battle.json", "utf8")));
    if (!(await setup.request.get(`/api/battles/${battleId}`)).ok()) battleId = undefined;
  } catch { /* The first review creates its own real battle. */ }
  if (!battleId) {
    const response = await setup.request.post("/api/battles", {
      data: { clientRequestId: randomUUID(), formatId: "gen9randombattle", player: { kind: "random" }, cpu: { kind: "random" } },
    });
    if (!response.ok()) throw new Error(`Create visual battle ${response.status()}`);
    battleId = (await response.json()).view.id;
    await writeFile("artifacts/visual-review/battle.json", JSON.stringify({ battleId }));
  }
  await setup.close();
  const routes = [["home", "/"], ["setup", "/play?format=gen9ou"], ["teams", "/teams"], ["battle", `/battle/${battleId}`], ["history", "/history"]];
  if (teams[0]) routes.push(["editor", `/teams/${teams[0].id}`]);
  if (finished[0]) routes.push(["replay", `/replay/${finished[0].id}`]);
  for (const [surface, options] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["mobile", devices["Pixel 7"]], ...(cycle === "3" ? [["mobile-short", { ...devices["Pixel 7"], viewport: { width: 360, height: 640 } }]] : [])]) {
    const context = await browser.newContext({ ...options, baseURL: "http://localhost:3000", storageState });
    const page = await context.newPage();
    for (const [name, route] of routes) {
      const errors = [];
      const badResponses = [];
      const onError = (error) => errors.push(error.message);
      const onConsole = (message) => { if (message.type() === "error") errors.push(message.text()); };
      const onResponse = (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); };
      page.on("pageerror", onError);
      page.on("console", onConsole);
      page.on("response", onResponse);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      const measurements = await page.evaluate(() => ({
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        failedImages: [...document.images].filter((image) => image.naturalWidth === 0).map((image) => image.getAttribute("src")),
        arena: document.querySelector("[data-fx-layer]")?.parentElement?.getBoundingClientRect().toJSON() ?? null,
        viewport: { width: innerWidth, height: innerHeight },
      }));
      const file = path.join(output, `${surface}-${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      report.push({ surface, name, route, file, ...measurements, errors, badResponses });
      page.off("pageerror", onError);
      page.off("console", onConsole);
      page.off("response", onResponse);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
const issues = report.filter((row) => row.horizontalOverflow || row.failedImages.length || row.errors.length || row.badResponses.length);
console.log(JSON.stringify({ cycle, screenshots: report.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
