import type { ActivePokemonView, BattleEvent, PokemonView, PublicBattleState, SideId, SideView } from "@/shared/contract";
import { effectId, isTerrain } from "./labels.ts";
import { toSpriteId } from "@/client/ui/format.ts";

function blankMon(species: string, slot: number): PokemonView {
  return {
    slot,
    name: species,
    species,
    spriteId: toSpriteId(species),
    level: 100,
    gender: "N",
    shiny: false,
    hp: 100,
    maxHp: 100,
    status: null,
    fainted: false,
    active: false,
    types: [],
    teraType: null,
    terastallized: null,
    item: null,
    itemSpriteNum: null,
    ability: null,
    moves: [],
  };
}

function findMon(team: PokemonView[], name: string, species?: string): PokemonView | undefined {
  return team.find((mon) => mon.name === name) ?? (species ? team.find((mon) => mon.species === species) : undefined);
}

function mirrorActive(side: SideView, mon: PokemonView, previous: ActivePokemonView | null) {
  if (!mon.active) {
    if (previous && previous.name === mon.name) side.active = null;
    return;
  }
  side.active = {
    ...mon,
    boosts: previous && previous.name === mon.name ? previous.boosts : {},
    volatiles: previous && previous.name === mon.name ? previous.volatiles : [],
  };
}

function editMon(side: SideView, name: string, species: string | undefined, update: (mon: PokemonView) => void): PokemonView | null {
  const mon = findMon(side.team, name, species);
  if (!mon) return null;
  const previous = side.active && side.active.name === mon.name ? side.active : null;
  update(mon);
  if (previous || mon.active) mirrorActive(side, mon, previous);
  return mon;
}

/**
 * Pure view reducer. Animations call this so the HUD matches the effect in flight.
 * After a frame, the caller snaps to the authoritative `frame.state`.
 */
export function applyEvent(state: PublicBattleState, event: BattleEvent): PublicBattleState {
  const next = structuredClone(state);
  switch (event.kind) {
    case "turn":
      next.turn = event.turn;
      break;
    case "teamPreview": {
      const side = next.sides[event.side];
      side.teamSize = event.species.length || side.teamSize;
      if (side.team.length === 0) side.team = event.species.map((species, index) => blankMon(species, index + 1));
      break;
    }
    case "switch": {
      const side = next.sides[event.pokemon.side];
      if (event.cause !== "replace") {
        for (const mon of side.team) mon.active = false;
      }
      let mon = event.cause === "replace" ? side.team.find((entry) => entry.active) : findMon(side.team, event.pokemon.name, event.species);
      if (!mon) {
        mon = blankMon(event.species, side.team.length + 1);
        side.team.push(mon);
      }
      const keep = event.cause === "replace" ? side.active : null;
      mon.name = event.pokemon.name;
      mon.species = event.species;
      mon.spriteId = event.spriteId || toSpriteId(event.species);
      mon.level = event.level;
      mon.gender = event.gender;
      mon.shiny = event.shiny;
      mon.hp = event.hp;
      if (event.maxHp > 0) mon.maxHp = event.maxHp;
      mon.status = event.status;
      mon.fainted = event.hp === 0;
      mon.active = true;
      side.active = {
        ...mon,
        boosts: keep?.boosts ?? {},
        volatiles: keep?.volatiles ? [...keep.volatiles] : [],
      };
      break;
    }
    case "move":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        if (!mon.moves.includes(event.move)) mon.moves.push(event.move);
      });
      break;
    case "formeChange":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        mon.species = event.species;
        mon.spriteId = event.spriteId || toSpriteId(event.species);
      });
      break;
    case "damage":
    case "heal":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        mon.hp = event.hp;
        if (event.maxHp > 0) mon.maxHp = event.maxHp;
        if (event.hp > 0) mon.fainted = false;
        if (event.status) mon.status = event.status;
      });
      break;
    case "faint": {
      const side = next.sides[event.pokemon.side];
      const mon = findMon(side.team, event.pokemon.name);
      if (!mon) break;
      mon.hp = 0;
      mon.fainted = true;
      mon.status = null;
      mon.active = false;
      if (side.active?.name === mon.name) side.active = null;
      break;
    }
    case "status":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        mon.status = event.status;
      });
      break;
    case "cureStatus": {
      const side = next.sides[event.pokemon.side];
      if (event.pokemon.name === "") {
        for (const mon of side.team) mon.status = null;
        if (side.active) side.active.status = null;
        break;
      }
      editMon(side, event.pokemon.name, undefined, (mon) => {
        mon.status = null;
      });
      break;
    }
    case "boost": {
      const active = next.sides[event.pokemon.side].active;
      if (!active || active.name !== event.pokemon.name) break;
      const current = active.boosts[event.stat] ?? 0;
      active.boosts[event.stat] = Math.max(-6, Math.min(6, current + event.amount));
      break;
    }
    case "clearBoosts": {
      const sides: SideId[] = event.pokemon ? [event.pokemon.side] : ["p1", "p2"];
      for (const id of sides) {
        const active = next.sides[id].active;
        if (!active) continue;
        if (event.pokemon && active.name !== event.pokemon.name) continue;
        active.boosts = {};
      }
      break;
    }
    case "weather":
      if (!event.upkeep || event.weather) next.field.weather = event.weather;
      if (!event.weather) next.field.weather = null;
      break;
    case "fieldStart":
    case "fieldEnd": {
      const key = effectId(event.effect);
      const ending = event.kind === "fieldEnd";
      if (isTerrain(event.effect)) {
        next.field.terrain = ending ? null : event.effect;
        break;
      }
      if (ending) next.field.pseudoWeather = next.field.pseudoWeather.filter((entry) => effectId(entry) !== key);
      else if (!next.field.pseudoWeather.some((entry) => effectId(entry) === key)) next.field.pseudoWeather.push(event.effect);
      break;
    }
    case "sideStart":
    case "sideEnd": {
      const side = next.sides[event.side];
      const key = effectId(event.effect);
      if (event.kind === "sideEnd") {
        side.conditions = side.conditions.filter((condition) => effectId(condition.id) !== key && effectId(condition.name) !== key);
        break;
      }
      const existing = side.conditions.find((condition) => effectId(condition.id) === key || effectId(condition.name) === key);
      if (existing) existing.layers += 1;
      else side.conditions.push({ id: key, name: event.effect, layers: 1 });
      break;
    }
    case "volatileStart":
    case "volatileEnd": {
      const active = next.sides[event.pokemon.side].active;
      if (!active || active.name !== event.pokemon.name) break;
      if (event.kind === "volatileEnd") active.volatiles = active.volatiles.filter((entry) => entry !== event.effect);
      else if (!active.volatiles.includes(event.effect)) active.volatiles.push(event.effect);
      break;
    }
    case "terastallize": {
      const side = next.sides[event.pokemon.side];
      side.canTerastallize = false;
      editMon(side, event.pokemon.name, undefined, (mon) => {
        mon.terastallized = event.teraType;
        mon.teraType = mon.teraType ?? event.teraType;
      });
      break;
    }
    case "ability":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        mon.ability = event.ability;
      });
      break;
    case "item":
      editMon(next.sides[event.pokemon.side], event.pokemon.name, undefined, (mon) => {
        if (event.consumed) {
          mon.item = null;
          mon.itemSpriteNum = null;
          return;
        }
        mon.item = event.item;
      });
      break;
    case "crit":
    case "effectiveness":
    case "message":
    case "win":
      break;
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
  return next;
}
