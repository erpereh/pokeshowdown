import "server-only";
import type {
  ActivePokemonView,
  BattleEvent,
  BoostId,
  PokemonView,
  PublicBattleState,
  SideId,
  SideView,
  StatusId,
} from "../../shared/contract/index.ts";
import type { ShowdownRequest } from "../cpu/contract.ts";
import { displayAbility, displayItem, displayMove, getSpeciesInfo, itemSpriteNum } from "./dex-cache.ts";
import { TERRAINS } from "./protocol-parser.ts";
import { nameFromIdent, parseCondition, parseDetails } from "./protocol-text.ts";

interface DraftMon {
  slot: number;
  name: string;
  species: string;
  spriteId: string;
  level: number;
  gender: "M" | "F" | "N";
  shiny: boolean;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  fainted: boolean;
  active: boolean;
  types: string[];
  teraType: string | null;
  terastallized: string | null;
  item: string | null;
  itemSpriteNum: number | null;
  ability: string | null;
  moves: string[];
  boosts: Partial<Record<BoostId, number>>;
  volatiles: string[];
}

interface DraftSide {
  id: SideId;
  name: string;
  teamSize: number;
  onField: boolean;
  teraUsed: boolean;
  team: DraftMon[];
  conditions: { id: string; name: string; layers: number }[];
}

interface Draft {
  turn: number;
  weather: string | null;
  terrain: string | null;
  pseudoWeather: string[];
  sides: Record<SideId, DraftSide>;
}

function effectId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function blankMon(speciesName: string, slot: number): DraftMon {
  const species = getSpeciesInfo(speciesName);
  return {
    slot,
    name: species.name,
    species: species.name,
    spriteId: species.spriteId,
    level: 100,
    gender: "N",
    shiny: false,
    hp: 100,
    maxHp: 100,
    status: null,
    fainted: false,
    active: false,
    types: [...species.types],
    teraType: null,
    terastallized: null,
    item: null,
    itemSpriteNum: null,
    ability: null,
    moves: [],
    boosts: {},
    volatiles: [],
  };
}

function createDraft(): Draft {
  const side = (id: SideId, name: string): DraftSide => ({
    id,
    name,
    teamSize: 6,
    onField: false,
    teraUsed: false,
    team: [],
    conditions: [],
  });
  return {
    turn: 0,
    weather: null,
    terrain: null,
    pseudoWeather: [],
    sides: { p1: side("p1", "Player"), p2: side("p2", "CPU") },
  };
}

function findMon(team: DraftMon[], name: string, species?: string): DraftMon | undefined {
  const byName = team.find((mon) => mon.name === name);
  if (byName) return byName;
  if (!species) return undefined;
  return (
    team.find((mon) => mon.species === species && !mon.active && mon.name === mon.species) ??
    team.find((mon) => mon.species === species)
  );
}

function deactivate(side: DraftSide) {
  for (const mon of side.team) {
    if (!mon.active) continue;
    mon.active = false;
    mon.boosts = {};
    mon.volatiles = [];
  }
}

function revealMove(mon: DraftMon, move: string) {
  if (!mon.moves.includes(move)) mon.moves.push(move);
}

function applyHp(mon: DraftMon, hp: number, maxHp: number) {
  mon.hp = hp;
  if (maxHp > 0) mon.maxHp = maxHp;
  if (hp > 0) mon.fainted = false;
}

function toView(mon: DraftMon): PokemonView {
  return {
    slot: mon.slot,
    name: mon.name,
    species: mon.species,
    spriteId: mon.spriteId,
    level: mon.level,
    gender: mon.gender,
    shiny: mon.shiny,
    hp: mon.hp,
    maxHp: mon.maxHp,
    status: mon.status,
    fainted: mon.fainted,
    active: mon.active,
    types: [...mon.types],
    teraType: mon.teraType,
    terastallized: mon.terastallized,
    item: mon.item,
    itemSpriteNum: mon.itemSpriteNum,
    ability: mon.ability,
    moves: [...mon.moves],
  };
}

function toSideView(side: DraftSide, canTerastallize: boolean): SideView {
  const activeMon = side.onField ? (side.team.find((mon) => mon.active) ?? null) : null;
  const active: ActivePokemonView | null = activeMon
    ? { ...toView(activeMon), boosts: { ...activeMon.boosts }, volatiles: [...activeMon.volatiles] }
    : null;
  return {
    id: side.id,
    name: side.name,
    teamSize: side.teamSize,
    active,
    team: side.team.map(toView),
    conditions: side.conditions.map((condition) => ({ ...condition })),
    canTerastallize,
  };
}

function applyEvent(draft: Draft, event: BattleEvent) {
  switch (event.kind) {
    case "turn":
      draft.turn = event.turn;
      return;
    case "teamPreview": {
      const side = draft.sides[event.side];
      side.teamSize = event.species.length || side.teamSize;
      if (side.team.length > 0) return;
      side.team = event.species.map((species, index) => blankMon(species, index + 1));
      return;
    }
    case "switch": {
      const side = draft.sides[event.pokemon.side];
      side.onField = true;
      if (event.cause !== "replace") deactivate(side);
      let mon = event.cause === "replace" ? side.team.find((entry) => entry.active) : undefined;
      if (!mon) mon = findMon(side.team, event.pokemon.name, event.species);
      if (!mon) {
        mon = blankMon(event.species, side.team.length + 1);
        side.team.push(mon);
      }
      const species = getSpeciesInfo(event.species);
      mon.name = event.pokemon.name;
      mon.species = species.name;
      mon.spriteId = event.spriteId || species.spriteId;
      mon.types = [...species.types];
      mon.level = event.level;
      mon.gender = event.gender;
      mon.shiny = event.shiny;
      mon.hp = event.hp;
      if (event.maxHp > 0) mon.maxHp = event.maxHp;
      mon.status = event.status;
      mon.fainted = event.hp === 0;
      mon.active = true;
      if (event.cause !== "replace") {
        mon.boosts = {};
        mon.volatiles = [];
      }
      return;
    }
    case "move": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (mon) revealMove(mon, event.move);
      return;
    }
    case "formeChange": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      const species = getSpeciesInfo(event.species);
      mon.species = species.name;
      mon.spriteId = event.spriteId || species.spriteId;
      mon.types = [...species.types];
      return;
    }
    case "damage":
    case "heal": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      applyHp(mon, event.hp, event.maxHp);
      if (event.status) mon.status = event.status;
      const revealedItem = event.from ? displayItem(event.from) : null;
      if (revealedItem) {
        mon.item = revealedItem;
        mon.itemSpriteNum = itemSpriteNum(revealedItem);
      }
      return;
    }
    case "faint": {
      const side = draft.sides[event.pokemon.side];
      const mon = findMon(side.team, event.pokemon.name);
      if (!mon) return;
      mon.hp = 0;
      mon.fainted = true;
      mon.status = null;
      mon.active = false;
      mon.boosts = {};
      mon.volatiles = [];
      return;
    }
    case "status": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (mon) mon.status = event.status;
      return;
    }
    case "cureStatus": {
      const side = draft.sides[event.pokemon.side];
      if (event.pokemon.name === "") {
        for (const mon of side.team) mon.status = null;
        return;
      }
      const mon = findMon(side.team, event.pokemon.name);
      if (mon) mon.status = null;
      return;
    }
    case "boost": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      const next = (mon.boosts[event.stat] ?? 0) + event.amount;
      mon.boosts[event.stat] = Math.max(-6, Math.min(6, next));
      return;
    }
    case "clearBoosts": {
      const mons = event.pokemon
        ? [findMon(draft.sides[event.pokemon.side].team, event.pokemon.name)].filter((mon) => mon !== undefined)
        : [...draft.sides.p1.team, ...draft.sides.p2.team].filter((mon) => mon.active);
      for (const mon of mons) mon.boosts = {};
      return;
    }
    case "weather":
      if (!event.upkeep || event.weather) draft.weather = event.weather;
      if (!event.weather) draft.weather = null;
      return;
    case "fieldStart":
    case "fieldEnd": {
      const key = effectId(event.effect);
      const ending = event.kind === "fieldEnd";
      if (TERRAINS.has(key)) {
        draft.terrain = ending ? null : event.effect;
        return;
      }
      if (ending) draft.pseudoWeather = draft.pseudoWeather.filter((entry) => effectId(entry) !== key);
      else if (!draft.pseudoWeather.some((entry) => effectId(entry) === key)) draft.pseudoWeather.push(event.effect);
      return;
    }
    case "sideStart":
    case "sideEnd": {
      const conditions = draft.sides[event.side].conditions;
      const key = effectId(event.effect);
      const existing = conditions.find((condition) => condition.id === key);
      if (event.kind === "sideEnd") {
        draft.sides[event.side].conditions = conditions.filter((condition) => condition.id !== key);
        return;
      }
      if (existing) existing.layers += 1;
      else conditions.push({ id: key, name: event.effect, layers: 1 });
      return;
    }
    case "volatileStart":
    case "volatileEnd": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      if (event.kind === "volatileEnd") mon.volatiles = mon.volatiles.filter((entry) => entry !== event.effect);
      else if (!mon.volatiles.includes(event.effect)) mon.volatiles.push(event.effect);
      return;
    }
    case "terastallize": {
      const side = draft.sides[event.pokemon.side];
      side.teraUsed = true;
      const mon = findMon(side.team, event.pokemon.name);
      if (!mon) return;
      mon.terastallized = event.teraType;
      mon.teraType = mon.teraType ?? event.teraType;
      return;
    }
    case "ability": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      mon.ability = displayAbility(event.ability) ?? event.ability;
      return;
    }
    case "item": {
      const mon = findMon(draft.sides[event.pokemon.side].team, event.pokemon.name);
      if (!mon) return;
      if (event.consumed) {
        mon.item = null;
        mon.itemSpriteNum = null;
        return;
      }
      const item = displayItem(event.item) ?? event.item;
      mon.item = item;
      mon.itemSpriteNum = itemSpriteNum(item);
      return;
    }
    case "crit":
    case "effectiveness":
    case "message":
    case "win":
      return;
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

function monFromRequest(pokemon: ShowdownRequest["side"]["pokemon"][number], slot: number, previous: DraftMon | undefined): DraftMon {
  const details = parseDetails(pokemon.details);
  const condition = parseCondition(pokemon.condition);
  const species = getSpeciesInfo(details.species || previous?.species || "MissingNo");
  const item = displayItem(pokemon.item);
  const ability = displayAbility(pokemon.ability || pokemon.baseAbility);
  const moves = pokemon.moves.map((move) => displayMove(move));
  const active = Boolean(pokemon.active) && !condition.fainted;
  return {
    slot,
    name: nameFromIdent(pokemon.ident) || species.name,
    species: species.name,
    spriteId: species.spriteId,
    level: details.level,
    gender: details.gender,
    shiny: details.shiny,
    hp: condition.maxHp > 0 ? condition.hp : 0,
    maxHp: condition.maxHp > 0 ? condition.maxHp : (previous?.maxHp ?? 0),
    status: condition.fainted ? null : condition.status,
    fainted: condition.fainted || condition.hp === 0,
    active,
    types: [...species.types],
    teraType: pokemon.teraType || null,
    terastallized: pokemon.terastallized || null,
    item,
    itemSpriteNum: itemSpriteNum(item),
    ability,
    moves,
    boosts: active && previous ? { ...previous.boosts } : {},
    volatiles: active && previous ? [...previous.volatiles] : [],
  };
}

/**
 * Pure reducer over one viewer's parsed events.
 * Own-side exact fields are merged afterwards from that side's latest request.
 */
export function reduceBattleState(events: readonly BattleEvent[]): PublicBattleState {
  const draft = createDraft();
  for (const event of events) applyEvent(draft, event);
  return publish(draft, null, "p1", true);
}

export function projectState(
  events: readonly BattleEvent[],
  viewer: SideId,
  request: ShowdownRequest | null,
  ended: boolean,
): PublicBattleState {
  const draft = createDraft();
  for (const event of events) applyEvent(draft, event);
  return publish(draft, request, viewer, ended);
}

function publish(draft: Draft, request: ShowdownRequest | null, viewer: SideId, ended: boolean): PublicBattleState {
  if (request && request.side.id === viewer && !ended) {
    const side = draft.sides[viewer];
    const previous = side.team;
    side.name = request.side.name || side.name;
    side.teamSize = request.side.pokemon.length;
    side.team = request.side.pokemon.map((pokemon, index) => {
      const name = nameFromIdent(pokemon.ident);
      const details = parseDetails(pokemon.details);
      const prior = findMon(previous, name, details.species);
      return monFromRequest(pokemon, index + 1, prior);
    });
    if (!side.onField) {
      for (const mon of side.team) mon.active = false;
    }
  } else if (request && request.side.id === viewer && ended) {
    fillHidden(draft.sides[viewer], request);
  }

  draft.sides[viewer].name = draft.sides[viewer].name || (viewer === "p1" ? "Player" : "CPU");
  const viewerTera = !ended && Boolean(request?.active?.[0]?.canTerastallize);
  return {
    turn: draft.turn,
    field: {
      weather: draft.weather,
      terrain: draft.terrain,
      pseudoWeather: [...draft.pseudoWeather],
    },
    sides: {
      p1: toSideView(draft.sides.p1, viewer === "p1" ? viewerTera : !draft.sides.p1.teraUsed),
      p2: toSideView(draft.sides.p2, viewer === "p2" ? viewerTera : !draft.sides.p2.teraUsed),
    },
  };
}

function fillHidden(side: DraftSide, request: ShowdownRequest) {
  for (const pokemon of request.side.pokemon) {
    const name = nameFromIdent(pokemon.ident);
    const details = parseDetails(pokemon.details);
    const mon = findMon(side.team, name, details.species);
    if (!mon) continue;
    const item = displayItem(pokemon.item);
    const ability = displayAbility(pokemon.ability || pokemon.baseAbility);
    if (item) {
      mon.item = item;
      mon.itemSpriteNum = itemSpriteNum(item);
    }
    if (ability) mon.ability = ability;
    if (pokemon.teraType) mon.teraType = pokemon.teraType;
    if (pokemon.terastallized) mon.terastallized = pokemon.terastallized;
    for (const move of pokemon.moves) revealMove(mon, displayMove(move));
  }
}
