import type { FormatId } from "./battle.ts";

export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type StatTable = Record<StatId, number>;

/** Same shape as Showdown's `PokemonSet`, restricted to the fields the builder edits. */
export interface PokemonSetData {
  name: string;
  species: string;
  item: string;
  ability: string;
  moves: string[];
  nature: string;
  gender: "" | "M" | "F" | "N";
  evs: StatTable;
  ivs: StatTable;
  level: number;
  shiny: boolean;
  teraType: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  formatId: FormatId;
  sets: PokemonSetData[];
  /** Result of the last `TeamValidator` run; teams can be saved while invalid. */
  valid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  formatId: FormatId;
  species: string[];
  spriteIds: string[];
  /** Primary type of the first Pokémon, used to colour the team card. */
  leadType: string | null;
  valid: boolean;
  updatedAt: string;
}

export interface ValidationProblem {
  /** 0-based index of the set, or null for team-level problems. */
  setIndex: number | null;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  problems: ValidationProblem[];
}

/* Dex lookups used by the Team Builder (served from Showdown's Dex). */

export interface SpeciesSummary {
  id: string;
  name: string;
  spriteId: string;
  num: number;
  types: string[];
  tier: string;
  baseStats: StatTable;
}

export interface SpeciesDetail extends SpeciesSummary {
  abilities: string[];
  /** Fixed gender ("M" | "F" | "N") or null when the player may choose. */
  gender: "M" | "F" | "N" | null;
  requiredItem: string | null;
  forceTeraType: string | null;
  weightkg: number;
}

export interface MoveSummary {
  id: string;
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority: number;
  shortDesc: string;
}

export interface NamedEntry {
  id: string;
  name: string;
  shortDesc: string;
  /** Items only: index in `itemicons-sheet.png`. */
  spriteNum?: number;
}

export interface NatureEntry {
  id: string;
  name: string;
  plus: StatId | null;
  minus: StatId | null;
}
