import "server-only";
import type { BoostId, PokemonView, PublicBattleState, SideId, SideView } from "../../shared/contract/index.ts";
import { getDex } from "../showdown/index.ts";
import type { CpuInput, ShowdownRequest } from "./contract.ts";
import { createPrng, type Prng } from "./prng.ts";

type GenDex = ReturnType<ReturnType<typeof getDex>["forGen"]>;

const dexCache = new Map<string, GenDex>();

export function dexForFormat(formatId: string | undefined): GenDex {
  const key = formatId || "gen9";
  const cached = dexCache.get(key);
  if (cached) return cached;
  const root = getDex();
  const format = formatId ? root.formats.get(formatId) : undefined;
  const dex = format?.exists ? root.forFormat(format) : root.forGen(9);
  dexCache.set(key, dex);
  return dex;
}

export function speciesFromDetails(details: string | undefined): string {
  if (!details) return "";
  return details.split(",")[0]?.trim() ?? "";
}

export function levelFromDetails(details: string | undefined): number {
  const match = /(?:^|,\s*)L(\d+)/.exec(details ?? "");
  const level = match ? Number(match[1]) : 100;
  return Number.isFinite(level) && level > 0 ? level : 100;
}

export function parseCondition(condition: string | undefined): { hp: number; maxHp: number; fainted: boolean } {
  if (!condition || condition.endsWith(" fnt")) return { hp: 0, maxHp: 1, fainted: true };
  const ratio = condition.split(" ")[0] ?? "";
  const [hpText, maxText] = ratio.split("/");
  const hp = Number(hpText);
  const maxHp = Number(maxText);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) {
    return { hp: 1, maxHp: 1, fainted: false };
  }
  return { hp, maxHp, fainted: hp <= 0 };
}

export interface SelfState {
  types: string[];
  teraType: string | null;
  terastallized: string | null;
  hp: number;
  maxHp: number;
  level: number;
  stats: { atk: number; def: number; spa: number; spd: number; spe: number };
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  boosts: Partial<Record<BoostId, number>>;
  item: string;
  ability: string;
}

export interface FoeState {
  species: string;
  /** Types used when we attack this Pokémon (tera replaces them, except Stellar). */
  types: string[];
  /** Types this Pokémon attacks with. */
  attackTypes: string[];
  ability: string | null;
  possibleAbilities: string[];
  moves: string[];
  hp: number;
  maxHp: number;
  status: string | null;
  level: number;
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  boosts: Partial<Record<BoostId, number>>;
}

export interface CpuContext {
  input: CpuInput;
  dex: GenDex;
  prng: Prng;
  selfId: SideId;
  foeId: SideId;
  self: SelfState;
  foe: FoeState | null;
  foePreview: { types: string[] }[];
  ownHazards: Record<string, number>;
  foeHazards: Record<string, number>;
}

function blankSide(id: SideId): SideView {
  return {
    id,
    name: id,
    teamSize: 0,
    active: null,
    team: [],
    conditions: [],
    canTerastallize: false,
  };
}

function usableView(view: PublicBattleState | undefined): PublicBattleState {
  if (view?.sides?.p1 && view?.sides?.p2) return view;
  return {
    turn: 0,
    field: { weather: null, terrain: null, pseudoWeather: [] },
    sides: { p1: blankSide("p1"), p2: blankSide("p2") },
  };
}

function listedTypes(dex: GenDex, speciesName: string, types: string[] | undefined, terastallized: string | null): string[] {
  if (terastallized && terastallized !== "Stellar") return [terastallized];
  if (types && types.length > 0) return [...types];
  const species = dex.species.get(speciesName);
  if (species.exists && species.types.length > 0) return [...species.types];
  return ["Normal"];
}

function attackTypes(dex: GenDex, speciesName: string, types: string[] | undefined, terastallized: string | null): string[] {
  if (terastallized && terastallized !== "Stellar") return [terastallized];
  if (types && types.length > 0) return [...types];
  const species = dex.species.get(speciesName);
  return species.exists && species.types.length > 0 ? [...species.types] : ["Normal"];
}

function abilityList(dex: GenDex, speciesName: string, revealed: string | null): string[] {
  if (revealed) return [revealed];
  const species = dex.species.get(speciesName);
  if (!species.exists) return [];
  const abilities = species.abilities;
  return [...new Set([abilities["0"], abilities["1"], abilities.H, abilities.S].filter((ability): ability is string => Boolean(ability)))];
}

function conditionKey(dex: GenDex, id: string, name: string): string {
  const source = (name || id).replace(/^move:\s*/i, "");
  return dex.toID(source);
}

function hazardMap(dex: GenDex, side: SideView | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  for (const condition of side?.conditions ?? []) {
    const key = conditionKey(dex, condition.id, condition.name);
    map[key] = Math.max(map[key] ?? 0, condition.layers || 1);
  }
  return map;
}

function previewTypes(dex: GenDex, mon: PokemonView): string[] {
  return listedTypes(dex, mon.species, mon.types, mon.terastallized);
}

const EMPTY_STATS = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };

export function buildContext(input: CpuInput): CpuContext {
  const dex = dexForFormat(input.formatId);
  const prng = createPrng(input.seedKey ?? "");
  const selfId: SideId = input.self === "p1" ? "p1" : "p2";
  const foeId: SideId = selfId === "p1" ? "p2" : "p1";
  const view = usableView(input.view);
  const request: ShowdownRequest = input.request;
  const party = request.side.pokemon;
  const activeMon = party.find((mon) => mon.active) ?? party[0];
  const speciesName = speciesFromDetails(activeMon?.details);
  const species = dex.species.get(speciesName);
  const originalTypes = species.exists && species.types.length > 0 ? [...species.types] : ["Normal"];
  const speciesBase = species.exists ? species.baseStats : EMPTY_STATS;
  const level = levelFromDetails(activeMon?.details);
  const hp = parseCondition(activeMon?.condition);
  const rawStats = activeMon?.stats;
  const selfView = view.sides[selfId];
  const foeSide = view.sides[foeId];
  const foeActive = foeSide?.active && !foeSide.active.fainted ? foeSide.active : null;
  const foeSpecies = dex.species.get(foeActive?.species ?? "");
  const revealedAbility = foeActive?.ability?.trim() ? foeActive.ability : null;
  const base = foeSpecies.exists ? foeSpecies.baseStats : EMPTY_STATS;

  const self: SelfState = {
    types: originalTypes,
    teraType: activeMon?.teraType?.trim() ? activeMon.teraType : null,
    terastallized: activeMon?.terastallized?.trim() ? activeMon.terastallized : null,
    hp: hp.hp,
    maxHp: hp.maxHp,
    level,
    stats: {
      atk: rawStats?.atk || 0,
      def: rawStats?.def || 0,
      spa: rawStats?.spa || 0,
      spd: rawStats?.spd || 0,
      spe: rawStats?.spe || 0,
    },
    baseStats: {
      hp: speciesBase.hp,
      atk: speciesBase.atk,
      def: speciesBase.def,
      spa: speciesBase.spa,
      spd: speciesBase.spd,
      spe: speciesBase.spe,
    },
    boosts: selfView?.active?.boosts ?? {},
    item: activeMon?.item ?? "",
    ability: activeMon?.ability || activeMon?.baseAbility || "",
  };

  const foe: FoeState | null = foeActive
    ? {
        species: foeActive.species,
        types: listedTypes(dex, foeActive.species, foeActive.types, foeActive.terastallized),
        attackTypes: attackTypes(dex, foeActive.species, foeActive.types, foeActive.terastallized),
        ability: revealedAbility,
        possibleAbilities: abilityList(dex, foeActive.species, revealedAbility),
        moves: foeActive.moves ?? [],
        hp: foeActive.hp,
        maxHp: foeActive.maxHp > 0 ? foeActive.maxHp : 1,
        status: foeActive.status,
        level: foeActive.level || 100,
        baseStats: {
          hp: base.hp,
          atk: base.atk,
          def: base.def,
          spa: base.spa,
          spd: base.spd,
          spe: base.spe,
        },
        boosts: foeActive.boosts ?? {},
      }
    : null;

  return {
    input,
    dex,
    prng,
    selfId,
    foeId,
    self,
    foe,
    foePreview: (foeSide?.team ?? []).map((mon) => ({ types: previewTypes(dex, mon) })),
    ownHazards: hazardMap(dex, selfView),
    foeHazards: hazardMap(dex, foeSide),
  };
}
