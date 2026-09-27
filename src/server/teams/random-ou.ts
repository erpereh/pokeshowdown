import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { PokemonSetData } from "../../shared/contract/index.ts";
import { createTeamValidator, getDex, getTeams } from "../showdown/index.ts";
import { normalizeSet } from "./format.ts";
import { problemSetIndex } from "./validation.ts";

interface RawRandomSet {
  species?: string;
  item?: string;
  ability?: string;
  moves?: string[];
  nature?: string;
  ivs?: Partial<PokemonSetData["ivs"]>;
  teraType?: string;
}

function sodiumSeed(key: string): `sodium,${string}` {
  return `sodium,${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function adaptRandomSet(raw: RawRandomSet): PokemonSetData | null {
  if (!raw.species) return null;
  const dex = getDex().forGen(9);
  const species = dex.species.get(raw.species);
  if (!species.exists) return null;
  return normalizeSet({
    name: species.baseSpecies,
    species: species.name,
    item: raw.item ?? "",
    ability: raw.ability ?? "",
    moves: raw.moves ?? [],
    nature: raw.nature || "Serious",
    gender: "",
    evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
    ivs: {
      hp: raw.ivs?.hp ?? 31,
      atk: raw.ivs?.atk ?? 31,
      def: raw.ivs?.def ?? 31,
      spa: raw.ivs?.spa ?? 31,
      spd: raw.ivs?.spd ?? 31,
      spe: raw.ivs?.spe ?? 31,
    },
    level: 100,
    shiny: false,
    teraType: raw.teraType || species.types[0] || "Normal",
  });
}

function dropProblematic(picked: PokemonSetData[], messages: string[]): void {
  const indexes = new Set<number>();
  for (const message of messages) {
    const index = problemSetIndex(message, picked);
    if (index !== null) indexes.add(index);
  }
  if (indexes.size === 0) {
    picked.pop();
    return;
  }
  const kept = picked.filter((_, index) => !indexes.has(index));
  picked.length = 0;
  picked.push(...kept);
}

/**
 * Option B: random-battle sets rewritten to level 100 / 84 EVs, kept only when
 * `gen9ou` accepts them. At most 20 generator calls.
 */
export function generateRandomOuTeam(seed?: string): PokemonSetData[] {
  const root = seed && seed.length > 0 ? seed : randomBytes(16).toString("hex");
  const teams = getTeams();
  const validator = createTeamValidator("gen9ou");
  const dex = getDex().forGen(9);
  const picked: PokemonSetData[] = [];
  const seen = new Set<string>();

  for (let generation = 0; generation < 20 && picked.length < 6; generation += 1) {
    let generated: RawRandomSet[];
    try {
      generated = teams.generate("gen9randombattle", { seed: sodiumSeed(`${root}:${generation}`) });
    } catch {
      continue;
    }
    for (const raw of generated) {
      if (picked.length >= 6) break;
      const set = adaptRandomSet(raw);
      if (!set) continue;
      const species = dex.species.get(set.species);
      if (!species.exists) continue;
      const baseId = dex.toID(species.baseSpecies);
      if (seen.has(baseId)) continue;
      const setProblems = validator.validateSet(set, {});
      if (setProblems && setProblems.length > 0) continue;
      seen.add(baseId);
      picked.push(set);
    }
    if (picked.length === 6) {
      const teamProblems = validator.validateTeam(picked);
      if (!teamProblems || teamProblems.length === 0) return picked;
      dropProblematic(picked, teamProblems);
    }
  }

  throw new Error("Failed to generate a valid gen9ou team");
}
