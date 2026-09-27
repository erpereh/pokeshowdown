import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BattleStream, Dex, TeamValidator, Teams, toID } from "../src/server/showdown/module.ts";

type PokemonSet = NonNullable<ReturnType<typeof Teams.unpack>>[number];
import { ENGINE_VERSION } from "./lib/catalog.ts";

const CANDIDATES = [
  "Kingambit",
  "Great Tusk",
  "Dragapult",
  "Gholdengo",
  "Iron Valiant",
  "Ting-Lu",
  "Corviknight",
  "Toxapex",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function gen9Moves(speciesId: string) {
  const learnsets = Dex.data.Learnsets as unknown as Record<string, { learnset?: Record<string, string[]> }>;
  const learnset = learnsets[speciesId]?.learnset ?? {};
  const moves: string[] = [];
  for (const [moveId, sources] of Object.entries(learnset)) {
    if (!sources.some((source) => source.startsWith("9"))) continue;
    const move = Dex.moves.get(moveId);
    if (!move.exists || move.isMax || move.isZ || move.isNonstandard) continue;
    moves.push(move.name);
    if (moves.length === 4) break;
  }
  return moves;
}

function legalSet(speciesName: string): PokemonSet | null {
  const species = Dex.species.get(speciesName);
  if (!species.exists) return null;
  const moves = gen9Moves(species.id);
  if (moves.length < 4) return null;
  return {
    name: species.baseSpecies,
    species: species.name,
    item: "Leftovers",
    ability: species.abilities["0"],
    moves,
    nature: "Adamant",
    gender: species.gender || "",
    evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 100,
    happiness: 255,
    teraType: species.types[0],
  };
}

function buildOuTeam() {
  const team: PokemonSet[] = [];
  for (const name of CANDIDATES) {
    const set = legalSet(name);
    if (set) team.push(set);
    if (team.length === 6) break;
  }
  assert(team.length === 6, `could not build 6 legal-looking sets, got ${team.length}`);
  return team;
}

async function simulateTurn() {
  const stream = new BattleStream();
  let turnReached = false;
  const received: string[] = [];
  const reading = (async () => {
    for await (const chunk of stream) {
      received.push(chunk);
      if (chunk.includes("|turn|")) turnReached = true;
      respond(stream, chunk);
      if (turnReached) break;
    }
  })();

  await stream.write(`>start ${JSON.stringify({ formatid: "gen9randombattle", seed: [1, 2, 3, 4] })}`);
  await stream.write(`>player p1 ${JSON.stringify({ name: "Alice" })}`);
  await stream.write(`>player p2 ${JSON.stringify({ name: "Bob" })}`);

  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error(`BattleStream did not reach a turn:\n${received.join("\n---\n").slice(0, 2000)}`)), 20000);
  });
  try {
    await Promise.race([reading, timeout]);
    assert(turnReached, `battle output did not include a turn:\n${received.join("\n---\n").slice(0, 2000)}`);
  } finally {
    await stream.destroy();
  }
}

function respond(stream: InstanceType<typeof BattleStream>, chunk: string) {
  const lines = chunk.split("\n");
  if (lines[0] !== "sideupdate") return;
  const player = lines[1];
  const message = lines.slice(2).join("\n");
  const jsonStart = message.indexOf("{");
  if (!player || jsonStart < 0 || !message.includes("|request|")) return;
  const request = JSON.parse(message.slice(jsonStart)) as {
    wait?: boolean;
    teamPreview?: boolean;
    forceSwitch?: boolean[];
    active?: Array<{ moves?: Array<{ disabled?: boolean }> }>;
  };
  if (request.wait) return;
  let choice = "default";
  if (request.forceSwitch?.some(Boolean)) {
    choice = "switch 2";
  } else if (request.active) {
    const moves = request.active[0]?.moves ?? [];
    const slot = moves.findIndex((move) => !move.disabled);
    choice = `move ${slot >= 0 ? slot + 1 : 1}`;
  }
  void stream.write(`>${player} ${choice}`);
}

function verifyAdapter() {
  const script = fileURLToPath(new URL("./verify-adapter.ts", import.meta.url));
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--conditions=react-server", script],
    { stdio: "inherit", cwd: process.cwd() },
  );
  assert(result.status === 0, "server adapter check failed");
}

function verifyComplement() {
  const file = JSON.parse(readFileSync(path.join(process.cwd(), "data", "complement", "es.json"), "utf8")) as {
    entries: Record<string, { name: string; genus?: string }>;
  };
  const typeNull = file.entries[toID("Type: Null")];
  assert(typeNull?.name.includes("Cero"), "Spanish complement is missing Código Cero");
  assert(file.entries.pikachu?.genus?.toLowerCase().includes("rat"), "Spanish complement is missing Pikachu genus");
}

async function main() {
  const kingambit = Dex.species.get("kingambit");
  assert(kingambit.exists && kingambit.gen === 9, "Dex did not resolve Kingambit as a Gen 9 species");
  assert(Dex.moves.get("kowtowcleave").exists, "Dex did not resolve Kowtow Cleave");
  assert(Dex.abilities.get("supremeoverlord").exists, "Dex did not resolve Supreme Overlord");
  assert(Dex.items.get("leftovers").exists, "Dex did not resolve Leftovers");

  const ou = Dex.formats.get("gen9ou");
  const random = Dex.formats.get("gen9randombattle");
  assert(ou.exists, "gen9ou is missing");
  assert(random.exists, "gen9randombattle is missing");

  const team = buildOuTeam();
  const packed = Teams.pack(team);
  const unpacked = Teams.unpack(packed);
  assert(unpacked?.length === team.length, "Teams.pack/unpack did not round-trip");
  assert(toID(unpacked[0].species) === toID(team[0].species), "unpacked species changed");
  const imported = Teams.import(Teams.export(team));
  assert(imported?.length === team.length, "Teams.export/import did not round-trip");

  const validator = new TeamValidator("gen9ou");
  const problems = validator.validateTeam(team);
  if (problems) throw new Error(`legal OU team was rejected:\n${problems.join("\n")}`);

  const illegal = team.map((set) => ({ ...set }));
  illegal[0] = { ...illegal[0], species: "Mewtwo", ability: "Pressure", moves: ["Psychic"] };
  const illegalProblems = validator.validateTeam(illegal);
  assert(illegalProblems && illegalProblems.length > 0, "TeamValidator accepted an illegal Mewtwo set");

  const randomTeam = Teams.generate("gen9randombattle");
  assert(randomTeam.length >= 1, "Random Battle did not generate a team");
  for (const set of randomTeam) {
    assert(Dex.species.get(set.species).exists, `generated species ${set.species} is missing from Dex`);
  }
  const randomValidator = new TeamValidator("gen9randombattle");
  const randomProblems = randomValidator.validateTeam(randomTeam);
  assert(
    randomProblems?.some((problem) => problem.includes("doesn't let you use your own team")),
    "gen9randombattle validator did not reject a user-supplied team",
  );

  await simulateTurn();
  verifyComplement();
  verifyAdapter();
  console.log(`engine ${ENGINE_VERSION} verified`);
}

await main();
