import "server-only";
import type { FormatId, MoveCategory } from "../../shared/contract/index.ts";
import { Dex, toID } from "../showdown/module.ts";
import { spriteIdForSpecies } from "./sprite-id.ts";

export interface CachedMove {
  id: string;
  name: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  priority: number;
  maxPp: number;
  target: string;
  shortDesc: string;
  flags: string[];
}

export interface CachedSpecies {
  name: string;
  spriteId: string;
  types: string[];
}

const dexByFormat = new Map<string, ReturnType<typeof Dex.forFormat>>();
const moves = new Map<string, CachedMove>();
const speciesCache = new Map<string, CachedSpecies>();
const itemSprites = new Map<string, number | null>();
const abilityNames = new Map<string, string | null>();
const itemNames = new Map<string, string | null>();

function dexFor(formatId: FormatId) {
  let dex = dexByFormat.get(formatId);
  if (!dex) {
    dex = Dex.forFormat(formatId);
    dexByFormat.set(formatId, dex);
  }
  return dex;
}

function asCategory(category: string): MoveCategory {
  if (category === "Physical" || category === "Special" || category === "Status") return category;
  return "Status";
}

export function getMoveInfo(formatId: FormatId, idOrName: string): CachedMove {
  const key = `${formatId}:${toID(idOrName)}`;
  const cached = moves.get(key);
  if (cached) return cached;

  const move = dexFor(formatId).moves.get(idOrName);
  const flags = move.exists
    ? Object.entries(move.flags)
        .filter((entry) => Boolean(entry[1]))
        .map(([flag]) => flag)
    : [];
  const info: CachedMove = {
    id: move.exists ? move.id : toID(idOrName),
    name: move.exists ? move.name : idOrName,
    type: move.exists ? move.type : "Normal",
    category: asCategory(move.exists ? move.category : "Status"),
    basePower: move.exists ? move.basePower : 0,
    accuracy: move.exists ? move.accuracy : true,
    priority: move.exists ? move.priority : 0,
    maxPp: move.exists ? move.pp : 0,
    target: move.exists ? move.target : "normal",
    shortDesc: move.exists ? move.shortDesc : "",
    flags,
  };
  moves.set(key, info);
  return info;
}

export function getSpeciesInfo(speciesName: string): CachedSpecies {
  const cached = speciesCache.get(speciesName);
  if (cached) return cached;
  const species = Dex.species.get(speciesName);
  const info: CachedSpecies = {
    name: species.exists ? species.name : speciesName,
    spriteId: spriteIdForSpecies(speciesName),
    types: species.exists ? [...species.types] : [],
  };
  speciesCache.set(speciesName, info);
  return info;
}

export function itemSpriteNum(itemName: string | null | undefined): number | null {
  if (!itemName) return null;
  const key = toID(itemName);
  if (!key) return null;
  if (itemSprites.has(key)) return itemSprites.get(key) ?? null;
  const item = Dex.items.get(itemName);
  const num = item.exists && typeof item.spritenum === "number" ? item.spritenum : null;
  itemSprites.set(key, num);
  return num;
}

export function displayAbility(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  const key = toID(idOrName);
  if (!key) return null;
  if (abilityNames.has(key)) return abilityNames.get(key) ?? null;
  const ability = Dex.abilities.get(idOrName);
  const name = ability.exists ? ability.name : null;
  abilityNames.set(key, name);
  return name;
}

const moveNames = new Map<string, string>();

export function displayMove(idOrName: string): string {
  const key = toID(idOrName);
  const cached = moveNames.get(key);
  if (cached) return cached;
  const move = Dex.moves.get(idOrName);
  const name = move.exists ? move.name : idOrName;
  if (key) moveNames.set(key, name);
  return name;
}

export function displayItem(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  const key = toID(idOrName);
  if (!key) return null;
  if (itemNames.has(key)) return itemNames.get(key) ?? null;
  const item = Dex.items.get(idOrName);
  const name = item.exists ? item.name : null;
  itemNames.set(key, name);
  return name;
}

/** Tera Blast uses the user's Tera type once they have terastallized. */
export function resolveMoveType(formatId: FormatId, moveName: string, teraType: string | null): string {
  const info = getMoveInfo(formatId, moveName);
  if (info.id === "terablast" && teraType) return teraType;
  return info.type;
}
