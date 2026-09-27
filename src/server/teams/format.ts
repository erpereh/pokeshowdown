import "server-only";
import type { PokemonSetData, StatId, StatTable } from "../../shared/contract/index.ts";
import { getDex, getTeams } from "../showdown/index.ts";

const STATS: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const MAX_TEXT = 20_000;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function clampEvs(partial: Partial<StatTable> | undefined): StatTable {
  const evs = {} as StatTable;
  for (const stat of STATS) evs[stat] = clampInt(partial?.[stat], 0, 252, 0);
  let total = STATS.reduce((sum, stat) => sum + evs[stat], 0);
  while (total > 510) {
    let pick: StatId = "hp";
    for (const stat of STATS) {
      if (evs[stat] > evs[pick] || (evs[stat] === evs[pick] && STATS.indexOf(stat) > STATS.indexOf(pick))) {
        pick = stat;
      }
    }
    if (evs[pick] <= 0) break;
    evs[pick] -= 1;
    total -= 1;
  }
  return evs;
}

function clampIvs(partial: Partial<StatTable> | undefined): StatTable {
  const ivs = {} as StatTable;
  for (const stat of STATS) ivs[stat] = clampInt(partial?.[stat], 0, 31, 31);
  return ivs;
}

interface NormalizableSet {
  name?: string;
  species?: string;
  item?: string;
  ability?: string;
  moves?: readonly string[] | null;
  nature?: string;
  gender?: string;
  evs?: Partial<StatTable> | null;
  ivs?: Partial<StatTable> | null;
  level?: number;
  shiny?: boolean;
  teraType?: string;
}

/** Fill Showdown defaults and strip values that cannot be sent to the simulator safely. */
export function normalizeSet(partial: NormalizableSet | null | undefined): PokemonSetData {
  const dex = getDex().forGen(9);
  const source = partial ?? {};
  const species = dex.species.get(source.species || source.name || "");
  const speciesName = species.exists ? species.name : dex.getName(String(source.species || source.name || "")) || "Unown";
  const baseName = species.exists ? species.baseSpecies : speciesName;
  const nickname = dex.getName(source.name || baseName) || dex.getName(baseName) || "Pokemon";
  const item = dex.items.get(source.item || "");
  const ability = dex.abilities.get(source.ability || "");
  const nature = dex.natures.get(source.nature || "");
  const requestedTera = dex.types.get(source.teraType || "");
  let teraType = requestedTera.exists ? requestedTera.name : species.types[0] || "Normal";
  if (species.exists && species.requiredTeraType) teraType = species.requiredTeraType;

  let gender: PokemonSetData["gender"] = "";
  if (species.exists && (species.gender === "M" || species.gender === "F" || species.gender === "N")) {
    gender = species.gender;
  } else if (source.gender === "M" || source.gender === "F" || source.gender === "N") {
    gender = source.gender;
  }

  const moves: string[] = [];
  for (const moveName of (source.moves ?? []).slice(0, 4)) {
    if (typeof moveName !== "string" || moveName.length > 50) continue;
    const move = dex.moves.get(moveName);
    if (!move.exists || move.isNonstandard) continue;
    moves.push(move.name);
  }

  const level = source.level === undefined || source.level === null
    ? 100
    : clampInt(source.level, 1, 100, 100);

  return {
    name: nickname,
    species: speciesName,
    item: item.exists ? item.name : "",
    ability: ability.exists ? ability.name : "",
    moves,
    nature: nature.exists && nature.id ? nature.name : "Serious",
    gender,
    evs: clampEvs(source.evs ?? undefined),
    ivs: clampIvs(source.ivs ?? undefined),
    level,
    shiny: source.shiny === true,
    teraType,
  };
}

export function importTeam(text: string): PokemonSetData[] {
  if (typeof text !== "string" || text.length === 0) return [];
  try {
    const imported = getTeams().import(text.slice(0, MAX_TEXT).replaceAll("\0", ""));
    if (!imported) return [];
    return imported.slice(0, 6).map((set) => normalizeSet(set));
  } catch {
    return [];
  }
}

export function exportTeam(sets: PokemonSetData[]): string {
  const normalized = (sets ?? []).slice(0, 6).map((set) => normalizeSet(set));
  return getTeams().export(normalized);
}

export function packTeam(sets: PokemonSetData[]): string {
  const normalized = (sets ?? []).slice(0, 6).map((set) => normalizeSet(set));
  return getTeams().pack(normalized);
}

export function unpackTeam(packed: string): PokemonSetData[] {
  if (typeof packed !== "string" || packed.length === 0) return [];
  try {
    const unpacked = getTeams().unpack(packed.slice(0, MAX_TEXT).replaceAll("\0", ""));
    if (!unpacked) return [];
    return unpacked.slice(0, 6).map((set) => normalizeSet(set));
  } catch {
    return [];
  }
}
