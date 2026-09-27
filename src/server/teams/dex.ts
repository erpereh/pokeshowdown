import "server-only";
import type {
  MoveSummary,
  NamedEntry,
  NatureEntry,
  SpeciesDetail,
  SpeciesSummary,
  StatId,
} from "../../shared/contract/index.ts";
import { getDex } from "../showdown/index.ts";

type GenDex = ReturnType<ReturnType<typeof getDex>["forGen"]>;
type Species = ReturnType<GenDex["species"]["get"]>;

const TIER_ORDER = ["OU", "UUBL", "UU", "RUBL", "RU", "NUBL", "NU", "PUBL", "PU", "ZU", "NFE", "LC", "AG", "Uber"];
const TYPE_ORDER = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy", "Stellar",
];

let speciesCache: SpeciesSummary[] | null = null;
let itemCache: NamedEntry[] | null = null;
let abilityCache: NamedEntry[] | null = null;
const detailCache = new Map<string, { species: SpeciesDetail; moves: MoveSummary[] }>();

function gen9(): GenDex {
  return getDex().forGen(9);
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function spriteIdFor(dex: GenDex, species: Species): string {
  const forme = species.forme ? `-${dex.toID(species.forme)}` : "";
  return `${dex.toID(species.baseSpecies)}${forme}`;
}

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier);
  return index === -1 ? TIER_ORDER.length : index;
}

function byPopularity(a: SpeciesSummary, b: SpeciesSummary): number {
  const tier = tierRank(a.tier) - tierRank(b.tier);
  if (tier !== 0) return tier;
  return a.name.localeCompare(b.name);
}

function toSummary(dex: GenDex, species: Species): SpeciesSummary {
  return {
    id: species.id,
    name: species.name,
    spriteId: spriteIdFor(dex, species),
    num: species.num,
    types: [...species.types],
    tier: species.tier,
    baseStats: {
      hp: species.baseStats.hp,
      atk: species.baseStats.atk,
      def: species.baseStats.def,
      spa: species.baseStats.spa,
      spd: species.baseStats.spd,
      spe: species.baseStats.spe,
    },
  };
}

function loadSpecies(): SpeciesSummary[] {
  if (speciesCache) return speciesCache;
  const dex = gen9();
  const list: SpeciesSummary[] = [];
  for (const species of dex.species.all()) {
    if (!species.exists || species.num <= 0 || species.isNonstandard || species.battleOnly) continue;
    list.push(toSummary(dex, species));
  }
  speciesCache = list;
  return list;
}

function loadItems(): NamedEntry[] {
  if (itemCache) return itemCache;
  const dex = gen9();
  const list: NamedEntry[] = [];
  for (const item of dex.items.all()) {
    if (!item.exists || item.isNonstandard || item.isPokeball) continue;
    list.push({
      id: item.id,
      name: item.name,
      shortDesc: item.shortDesc ?? "",
      spriteNum: item.spritenum,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  itemCache = list;
  return list;
}

function loadAbilities(): NamedEntry[] {
  if (abilityCache) return abilityCache;
  const dex = gen9();
  const list: NamedEntry[] = [];
  for (const ability of dex.abilities.all()) {
    if (!ability.exists || ability.isNonstandard) continue;
    list.push({ id: ability.id, name: ability.name, shortDesc: ability.shortDesc ?? "" });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  abilityCache = list;
  return list;
}

function searchNamed(entries: NamedEntry[], query: string): NamedEntry[] {
  const folded = fold(query ?? "");
  if (!folded) return entries.slice(0, 40);
  const starts: NamedEntry[] = [];
  const contains: NamedEntry[] = [];
  for (const entry of entries) {
    const name = fold(entry.name);
    const id = fold(entry.id);
    if (name.startsWith(folded) || id.startsWith(folded)) starts.push(entry);
    else if (name.includes(folded) || id.includes(folded)) contains.push(entry);
  }
  return [...starts, ...contains];
}

function learnableMoves(dex: GenDex, species: Species): MoveSummary[] {
  const ids = new Set<string>();
  const seen = new Set<string>();
  const walk = (current: Species) => {
    if (!current.exists || seen.has(current.id)) return;
    seen.add(current.id);
    const learnset = dex.species.getLearnsetData(current.id).learnset;
    if (learnset) {
      for (const [moveId, sources] of Object.entries(learnset)) {
        if (sources?.some((source) => String(source).startsWith("9"))) ids.add(moveId);
      }
    }
    if (current.prevo) walk(dex.species.get(current.prevo));
    if (current.changesFrom) walk(dex.species.get(current.changesFrom));
    if (current.baseSpecies && current.baseSpecies !== current.name) walk(dex.species.get(current.baseSpecies));
  };
  walk(species);
  for (const moveId of dex.species.getMovePool(species.id)) ids.add(moveId);

  const moves: MoveSummary[] = [];
  for (const moveId of ids) {
    const move = dex.moves.get(moveId);
    if (!move.exists || move.isNonstandard || move.isZ || move.isMax) continue;
    moves.push({
      id: move.id,
      name: move.name,
      type: move.type,
      category: move.category,
      basePower: move.basePower,
      accuracy: move.accuracy,
      pp: move.pp,
      priority: move.priority ?? 0,
      shortDesc: move.shortDesc ?? "",
    });
  }
  moves.sort((a, b) => a.name.localeCompare(b.name));
  return moves;
}

export function searchSpecies(query: string, limit = 40): SpeciesSummary[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 40;
  const folded = fold(query ?? "");
  const all = loadSpecies();
  if (!folded) return [...all].sort(byPopularity).slice(0, cap);
  const starts: SpeciesSummary[] = [];
  const contains: SpeciesSummary[] = [];
  for (const species of all) {
    const name = fold(species.name);
    const id = fold(species.id);
    if (name.startsWith(folded) || id.startsWith(folded)) starts.push(species);
    else if (name.includes(folded) || id.includes(folded)) contains.push(species);
  }
  starts.sort((a, b) => a.name.localeCompare(b.name));
  contains.sort((a, b) => a.name.localeCompare(b.name));
  return [...starts, ...contains].slice(0, cap);
}

export function getSpeciesDetail(id: string): { species: SpeciesDetail; moves: MoveSummary[] } {
  const dex = gen9();
  const key = dex.toID(id);
  const cached = detailCache.get(key);
  if (cached) return cached;
  const species = dex.species.get(key);
  if (!species.exists) throw new Error(`Unknown species: ${id}`);
  const abilities = [...new Set(
    [species.abilities["0"], species.abilities["1"], species.abilities.H, species.abilities.S]
      .filter((ability): ability is string => Boolean(ability)),
  )];
  const gender = species.gender === "M" || species.gender === "F" || species.gender === "N" ? species.gender : null;
  const detail: SpeciesDetail = {
    ...toSummary(dex, species),
    abilities,
    gender,
    requiredItem: species.requiredItems?.[0] ?? species.requiredItem ?? null,
    forceTeraType: species.requiredTeraType ?? null,
    weightkg: species.weightkg,
  };
  const result = { species: detail, moves: learnableMoves(dex, species) };
  detailCache.set(key, result);
  return result;
}

export function searchItems(query: string): NamedEntry[] {
  return searchNamed(loadItems(), query);
}

export function searchAbilities(query: string): NamedEntry[] {
  return searchNamed(loadAbilities(), query);
}

export function listNatures(): NatureEntry[] {
  const dex = gen9();
  return dex.natures.all()
    .filter((nature) => nature.exists)
    .map((nature) => ({
      id: nature.id,
      name: nature.name,
      plus: (nature.plus ?? null) as StatId | null,
      minus: (nature.minus ?? null) as StatId | null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listTypes(): NamedEntry[] {
  const dex = gen9();
  return TYPE_ORDER.map((name) => dex.types.get(name))
    .filter((type) => type.exists)
    .map((type) => ({ id: type.id, name: type.name, shortDesc: "" }));
}
