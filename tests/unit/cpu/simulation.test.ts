import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { ActivePokemonView, BoostId, PokemonView, PublicBattleState, SideId, SideView, StatusId } from "../../../src/shared/contract/battle.ts";
import type { ShowdownRequest } from "../../../src/server/cpu/contract.ts";
import { chooseCpuActions } from "../../../src/server/cpu/index.ts";
import { packTeam } from "../../../src/server/teams/format.ts";
import { generateRandomOuTeam } from "../../../src/server/teams/random-ou.ts";

const require = createRequire(import.meta.url);
const showdown = require("pokemon-showdown") as typeof import("pokemon-showdown");
const { BattleStream, Dex, Teams } = showdown;

const dex = Dex.forGen(9);
const STATUSES = new Set<StatusId>(["brn", "par", "slp", "frz", "psn", "tox"]);

function sodium(key: string): `sodium,${string}` {
  return `sodium,${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function parseDetails(details: string): { species: string; level: number; gender: "M" | "F" | "N"; shiny: boolean } {
  const parts = details.split(",").map((part) => part.trim());
  let level = 100;
  let gender: "M" | "F" | "N" = "N";
  let shiny = false;
  for (const part of parts.slice(1)) {
    if (/^L\d+$/.test(part)) level = Number(part.slice(1));
    else if (part === "M" || part === "F") gender = part;
    else if (part === "shiny") shiny = true;
  }
  return { species: parts[0] || "Unknown", level, gender, shiny };
}

function parseHealth(raw: string | undefined): { hp: number; maxHp: number; status: StatusId | null; fainted: boolean } {
  if (!raw || raw.endsWith(" fnt")) return { hp: 0, maxHp: 1, status: null, fainted: true };
  const [ratio, status] = raw.split(" ");
  const [hpText, maxText] = (ratio ?? "").split("/");
  const hp = Number(hpText);
  const maxHp = Number(maxText);
  return {
    hp: Number.isFinite(hp) ? hp : 0,
    maxHp: Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 100,
    status: status && STATUSES.has(status as StatusId) ? status as StatusId : null,
    fainted: !Number.isFinite(hp) || hp <= 0,
  };
}

function identOf(token: string | undefined): { side: SideId; name: string } | null {
  const match = /^(p[12])[a-z]: (.+)$/.exec(token ?? "");
  if (!match) return null;
  return { side: match[1] as SideId, name: match[2] ?? "" };
}

function sideOf(token: string | undefined): SideId | null {
  const match = /^(p[12])(?::| )/.exec(token ?? "");
  return match ? match[1] as SideId : null;
}

interface TrackedMon {
  name: string;
  species: string;
  level: number;
  gender: "M" | "F" | "N";
  shiny: boolean;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  fainted: boolean;
  active: boolean;
  terastallized: string | null;
  item: string | null;
  ability: string | null;
  moves: string[];
  boosts: Partial<Record<BoostId, number>>;
}

class PublicTracker {
  turn = 0;
  weather: string | null = null;
  terrain: string | null = null;
  pseudoWeather: string[] = [];
  readonly mons: Record<SideId, TrackedMon[]> = { p1: [], p2: [] };
  readonly conditions: Record<SideId, Map<string, { id: string; name: string; layers: number }>> = {
    p1: new Map(),
    p2: new Map(),
  };

  find(side: SideId, name: string, species?: string): TrackedMon | undefined {
    return this.mons[side].find((mon) => mon.name === name || mon.species === name || (species !== undefined && mon.species === species));
  }

  apply(line: string): void {
    if (!line.startsWith("|")) return;
    const parts = line.split("|");
    const command = parts[1];
    if (command === "turn") {
      this.turn = Number(parts[2]) || this.turn;
      return;
    }
    if (command === "poke") {
      const side = parts[2] as SideId;
      if (side !== "p1" && side !== "p2") return;
      const details = parseDetails(parts[3] ?? "");
      if (this.mons[side].some((mon) => mon.species === details.species)) return;
      this.mons[side].push({
        name: details.species,
        species: details.species,
        level: details.level,
        gender: details.gender,
        shiny: details.shiny,
        hp: 100,
        maxHp: 100,
        status: null,
        fainted: false,
        active: false,
        terastallized: null,
        item: null,
        ability: null,
        moves: [],
        boosts: {},
      });
      return;
    }
    if (command === "switch" || command === "drag" || command === "replace") {
      const ident = identOf(parts[2]);
      if (!ident) return;
      const details = parseDetails(parts[3] ?? "");
      const health = parseHealth(parts[4]);
      let mon = this.find(ident.side, ident.name, details.species);
      if (!mon) {
        mon = {
          name: ident.name,
          species: details.species,
          level: details.level,
          gender: details.gender,
          shiny: details.shiny,
          hp: health.hp,
          maxHp: health.maxHp,
          status: health.status,
          fainted: health.fainted,
          active: false,
          terastallized: null,
          item: null,
          ability: null,
          moves: [],
          boosts: {},
        };
        this.mons[ident.side].push(mon);
      }
      mon.name = ident.name;
      mon.species = details.species;
      mon.level = details.level;
      mon.gender = details.gender;
      mon.shiny = details.shiny;
      if (command !== "replace" || parts[4]) {
        mon.hp = health.hp;
        mon.maxHp = health.maxHp;
        mon.status = health.status;
        mon.fainted = health.fainted;
      }
      for (const other of this.mons[ident.side]) other.active = false;
      mon.active = !mon.fainted;
      return;
    }
    if (command === "move") {
      const ident = identOf(parts[2]);
      const move = parts[3];
      if (!ident || !move) return;
      const mon = this.find(ident.side, ident.name);
      if (mon && !mon.moves.includes(move)) mon.moves.push(move);
      return;
    }
    if (command === "-damage" || command === "-heal" || command === "-sethp") {
      const ident = identOf(parts[2]);
      if (!ident) return;
      const mon = this.find(ident.side, ident.name);
      if (!mon) return;
      const health = parseHealth(parts[3]);
      mon.hp = health.hp;
      mon.maxHp = health.maxHp;
      mon.status = health.status ?? mon.status;
      mon.fainted = health.fainted;
      return;
    }
    if (command === "faint") {
      const ident = identOf(parts[2]);
      if (!ident) return;
      const mon = this.find(ident.side, ident.name);
      if (!mon) return;
      mon.hp = 0;
      mon.fainted = true;
      mon.active = false;
      mon.boosts = {};
      return;
    }
    if (command === "-status") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (mon && STATUSES.has(parts[3] as StatusId)) mon.status = parts[3] as StatusId;
      return;
    }
    if (command === "-curestatus") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (mon) mon.status = null;
      return;
    }
    if (command === "-ability") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (mon && parts[3]) mon.ability = parts[3];
      return;
    }
    if (command === "-item" || command === "item" || command === "-enditem") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (!mon) return;
      mon.item = command === "-enditem" ? null : parts[3] || mon.item;
      return;
    }
    if (command === "-terastallize") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (mon && parts[3]) mon.terastallized = parts[3];
      return;
    }
    if (command === "-boost" || command === "-unboost") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      const stat = parts[3] as BoostId;
      const amount = Number(parts[4]) || 0;
      if (!mon || !stat) return;
      const current = mon.boosts[stat] ?? 0;
      mon.boosts[stat] = command === "-boost" ? current + amount : current - amount;
      return;
    }
    if (command === "-clearboost" || command === "-clearallboost") {
      const ident = identOf(parts[2]);
      const mon = ident ? this.find(ident.side, ident.name) : undefined;
      if (mon) mon.boosts = {};
      return;
    }
    if (command === "-sidestart" || command === "-sideend") {
      const side = sideOf(parts[2]);
      if (!side) return;
      const name = (parts[3] ?? "").replace(/^move:\s*/i, "");
      const id = dex.toID(name);
      if (!id) return;
      if (command === "-sideend") {
        this.conditions[side].delete(id);
        return;
      }
      const current = this.conditions[side].get(id);
      this.conditions[side].set(id, { id, name, layers: (current?.layers ?? 0) + 1 });
      return;
    }
    if (command === "-weather") {
      if (parts[3] === "[upkeep]") return;
      this.weather = !parts[2] || parts[2] === "none" ? null : parts[2];
      return;
    }
    if (command === "-fieldstart" || command === "-fieldend") {
      const name = (parts[2] ?? "").replace(/^move:\s*/i, "");
      const id = dex.toID(name);
      if (command === "-fieldend") {
        this.pseudoWeather = this.pseudoWeather.filter((entry) => entry !== id);
        if (this.terrain === id) this.terrain = null;
        return;
      }
      if (id.endsWith("terrain")) this.terrain = id;
      else if (!this.pseudoWeather.includes(id)) this.pseudoWeather.push(id);
    }
  }
}

function spriteId(speciesName: string): string {
  const species = dex.species.get(speciesName);
  if (!species.exists) return dex.toID(speciesName);
  return `${dex.toID(species.baseSpecies)}${species.forme ? `-${dex.toID(species.forme)}` : ""}`;
}

function speciesTypes(speciesName: string): string[] {
  const species = dex.species.get(speciesName);
  return species.exists && species.types.length > 0 ? [...species.types] : ["Normal"];
}

function toPokemonView(mon: TrackedMon, slot: number): PokemonView {
  return {
    slot,
    name: mon.name,
    species: mon.species,
    spriteId: spriteId(mon.species),
    level: mon.level,
    gender: mon.gender,
    shiny: mon.shiny,
    hp: mon.hp,
    maxHp: mon.maxHp,
    status: mon.status,
    fainted: mon.fainted,
    active: mon.active && !mon.fainted,
    types: speciesTypes(mon.species),
    teraType: null,
    terastallized: mon.terastallized,
    item: mon.item,
    itemSpriteNum: null,
    ability: mon.ability,
    moves: [...mon.moves],
  };
}

function conditionsOf(tracker: PublicTracker, side: SideId): SideView["conditions"] {
  return [...tracker.conditions[side].values()];
}

function sideFromTracker(tracker: PublicTracker, side: SideId, name: string): SideView {
  const team = tracker.mons[side].map((mon, index) => toPokemonView(mon, index + 1));
  const activeIndex = tracker.mons[side].findIndex((mon) => mon.active && !mon.fainted);
  const activeMon = activeIndex >= 0 ? tracker.mons[side][activeIndex] : undefined;
  const active: ActivePokemonView | null = activeMon
    ? { ...toPokemonView(activeMon, activeIndex + 1), boosts: { ...activeMon.boosts }, volatiles: [] }
    : null;
  return {
    id: side,
    name,
    teamSize: Math.max(team.length, 6),
    active,
    team,
    conditions: conditionsOf(tracker, side),
    canTerastallize: false,
  };
}

function sideFromRequest(request: ShowdownRequest, tracker: PublicTracker, side: SideId): SideView {
  const team: PokemonView[] = request.side.pokemon.map((mon, index) => {
    const details = parseDetails(mon.details);
    const health = parseHealth(mon.condition);
    const nickname = identOf(mon.ident)?.name || details.species;
    const tracked = tracker.find(side, nickname, details.species);
    return {
      slot: index + 1,
      name: nickname,
      species: details.species,
      spriteId: spriteId(details.species),
      level: details.level,
      gender: details.gender,
      shiny: details.shiny,
      hp: health.hp,
      maxHp: health.maxHp,
      status: health.status,
      fainted: health.fainted,
      active: Boolean(mon.active),
      types: speciesTypes(details.species),
      teraType: mon.teraType || null,
      terastallized: mon.terastallized || null,
      item: mon.item || null,
      itemSpriteNum: null,
      ability: mon.ability || mon.baseAbility || null,
      moves: mon.moves ?? [],
    };
  });
  const activeIndex = team.findIndex((mon) => mon.active);
  const activeMon = activeIndex >= 0 ? team[activeIndex] : undefined;
  const tracked = activeMon ? tracker.find(side, activeMon.name, activeMon.species) : undefined;
  const active: ActivePokemonView | null = activeMon
    ? { ...activeMon, boosts: { ...(tracked?.boosts ?? {}) }, volatiles: [] }
    : null;
  return {
    id: side,
    name: request.side.name,
    teamSize: team.length,
    active,
    team,
    conditions: conditionsOf(tracker, side),
    canTerastallize: Boolean(request.active?.[0]?.canTerastallize),
  };
}

function buildView(self: SideId, request: ShowdownRequest, tracker: PublicTracker): PublicBattleState {
  const foe: SideId = self === "p1" ? "p2" : "p1";
  const sides = {
    p1: sideFromTracker(tracker, "p1", "P1"),
    p2: sideFromTracker(tracker, "p2", "P2"),
  };
  sides[self] = sideFromRequest(request, tracker, self);
  sides[foe] = sideFromTracker(tracker, foe, foe === "p1" ? "P1" : "P2");
  return {
    turn: tracker.turn,
    field: { weather: tracker.weather, terrain: tracker.terrain, pseudoWeather: [...tracker.pseudoWeather] },
    sides,
  };
}

function publicLines(data: string): string[] {
  const raw = data.split("\n");
  const lines: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index] ?? "";
    if (line.startsWith("|split|")) {
      const revealed = raw[index + 2];
      if (revealed) lines.push(revealed);
      index += 2;
      continue;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function signature(request: ShowdownRequest): string {
  const party = request.side.pokemon.map((mon) => `${mon.details}|${mon.condition}|${mon.active ? 1 : 0}`).join(";");
  if (request.wait) return `wait:${party}`;
  if (request.teamPreview) return `preview:${party}`;
  if (request.forceSwitch?.some(Boolean)) return `switch:${request.forceSwitch.join(",")}:${party}`;
  const active = request.active?.[0];
  const moves = (active?.moves ?? []).map((move) => `${move.id}:${move.disabled ? 1 : 0}`).join(",");
  return `move:${active?.trapped ? 1 : 0}:${active?.maybeTrapped ? 1 : 0}:${active?.canTerastallize ?? ""}:${moves}:${party}`;
}

interface BattleResult {
  formatId: "gen9randombattle" | "gen9ou";
  seed: string;
  winner: string;
  turns: number;
  choiceErrors: number;
  error: string | null;
}

async function runBattle(formatId: BattleResult["formatId"], index: number): Promise<BattleResult> {
  const seed = sodium(`${formatId}:${index}`);
  const stream = new BattleStream();
  const queue: string[] = [];
  const readErrors: string[] = [];
  void (async () => {
    try {
      for await (const chunk of stream) queue.push(String(chunk));
    } catch (error) {
      readErrors.push(error instanceof Error ? error.message : String(error));
    }
  })();

  const tracker = new PublicTracker();
  const requests: Partial<Record<SideId, ShowdownRequest>> = {};
  const pendingError: Partial<Record<SideId, string>> = {};
  const tried = new WeakMap<ShowdownRequest, Set<string>>();
  const satisfied: Partial<Record<SideId, ShowdownRequest>> = {};
  let choiceErrors = 0;
  let fatal: string | null = null;

  const ingest = () => {
    while (queue.length > 0) {
      const chunk = queue.shift() ?? "";
      const splitAt = chunk.indexOf("\n");
      const type = splitAt === -1 ? chunk : chunk.slice(0, splitAt);
      const data = splitAt === -1 ? "" : chunk.slice(splitAt + 1);
      if (type === "update") {
        for (const line of publicLines(data)) tracker.apply(line);
      } else if (type === "sideupdate") {
        const breakAt = data.indexOf("\n");
        const side = data.slice(0, breakAt) as SideId;
        const rest = data.slice(breakAt + 1);
        if (rest.startsWith("|request|")) {
          try {
            requests[side] = JSON.parse(rest.slice("|request|".length)) as ShowdownRequest;
          } catch (error) {
            fatal = error instanceof Error ? error.message : String(error);
          }
        } else if (rest.startsWith("|error|")) {
          pendingError[side] = rest;
          choiceErrors += 1;
        }
      }
    }
  };

  const pump = async (line: string) => {
    stream.write(line.endsWith("\n") ? line : `${line}\n`);
    await new Promise((resolve) => setImmediate(resolve));
    ingest();
  };

  const p1Team = formatId === "gen9ou"
    ? packTeam(generateRandomOuTeam(`${seed}:p1`))
    : Teams.pack(Teams.generate("gen9randombattle", { seed: sodium(`${seed}:p1`) }));
  const p2Team = formatId === "gen9ou"
    ? packTeam(generateRandomOuTeam(`${seed}:p2`))
    : Teams.pack(Teams.generate("gen9randombattle", { seed: sodium(`${seed}:p2`) }));

  await pump(`>start ${JSON.stringify({ formatid: formatId, seed })}`);
  await pump(`>player p1 ${JSON.stringify({ name: "P1", team: p1Team })}`);
  await pump(`>player p2 ${JSON.stringify({ name: "P2", team: p2Team })}`);

  let steps = 0;
  let idle = 0;
  while (steps < 4000 && !stream.battle?.ended && !fatal && readErrors.length === 0) {
    steps += 1;
    ingest();
    if ((stream.battle?.turn ?? 0) > 500) {
      fatal = `exceeded 500 turns (${stream.battle?.turn})`;
      break;
    }
    let acted = false;
    for (const side of ["p1", "p2"] as const) {
      const request = requests[side];
      if (!request || request.wait || fatal || satisfied[side] === request) continue;
      const key = signature(request);
      const used = tried.get(request) ?? new Set<string>();
      tried.set(request, used);
      const choices = chooseCpuActions({
        formatId,
        self: side,
        request,
        view: buildView(side, request, tracker),
        seedKey: `${seed}:${tracker.turn}:${side}:${key}`,
      });
      const next = choices.find((choice) => !used.has(choice));
      if (!next) {
        fatal = `${side} exhausted choices at turn ${stream.battle?.turn ?? tracker.turn}: ${[...used].join(", ")}`;
        break;
      }
      used.add(next);
      pendingError[side] = undefined;
      await pump(`>${side} ${next}`);
      acted = true;
      if (pendingError[side] || requests[side] !== request) continue;
      satisfied[side] = request;
    }
    if (fatal) break;
    if (!acted) {
      idle += 1;
      await new Promise((resolve) => setImmediate(resolve));
      ingest();
      if (idle > 8) {
        fatal = `stalled at turn ${stream.battle?.turn ?? tracker.turn}`;
        break;
      }
    } else {
      idle = 0;
    }
  }

  if (!stream.battle?.ended && !fatal && readErrors.length === 0) fatal = "battle did not finish";
  const winner = stream.battle?.winner || (stream.battle?.ended ? "tie" : "");
  const turns = stream.battle?.turn ?? tracker.turn;
  return {
    formatId,
    seed,
    winner,
    turns,
    choiceErrors,
    error: fatal ?? readErrors[0] ?? null,
  };
}

describe("CPU vs CPU simulation", () => {
  it("finishes random and OU battles without hanging on choice errors", async () => {
    const results: BattleResult[] = [];
    for (let index = 0; index < 30; index += 1) results.push(await runBattle("gen9randombattle", index));
    for (let index = 0; index < 10; index += 1) results.push(await runBattle("gen9ou", index));

    const summarize = (formatId: BattleResult["formatId"]) => {
      const battles = results.filter((result) => result.formatId === formatId);
      const turns = battles.reduce((sum, result) => sum + result.turns, 0);
      return {
        battles: battles.length,
        winsP1: battles.filter((result) => result.winner === "P1").length,
        winsP2: battles.filter((result) => result.winner === "P2").length,
        ties: battles.filter((result) => result.winner === "tie").length,
        avgTurns: battles.length ? Math.round((turns / battles.length) * 10) / 10 : 0,
        choiceErrors: battles.reduce((sum, result) => sum + result.choiceErrors, 0),
        failures: battles.filter((result) => result.error || !result.winner).map((result) => ({
          seed: result.seed,
          turns: result.turns,
          error: result.error,
        })),
      };
    };

    const summary = {
      random: summarize("gen9randombattle"),
      ou: summarize("gen9ou"),
    };
    console.log(JSON.stringify(summary, null, 2));
    expect(summary.random.failures).toEqual([]);
    expect(summary.ou.failures).toEqual([]);
    expect(summary.random.battles).toBe(30);
    expect(summary.ou.battles).toBe(10);
    for (const result of results) {
      expect(result.turns).toBeLessThanOrEqual(500);
      expect(result.winner === "P1" || result.winner === "P2" || result.winner === "tie").toBe(true);
    }
  }, 180_000);
});
