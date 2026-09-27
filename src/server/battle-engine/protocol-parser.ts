import "server-only";
import type {
  BattleEvent,
  BoostId,
  EffectivenessValue,
  FormatId,
  PokemonRef,
  SideId,
  StatusId,
} from "../../shared/contract/index.ts";
import { getMoveInfo, resolveMoveType } from "./dex-cache.ts";
import { spriteIdForSpecies } from "./sprite-id.ts";
import {
  abilityText,
  activateText,
  boostText,
  cantText,
  clearBoostText,
  critText,
  cureText,
  damageText,
  effectivenessText,
  failText,
  faintText,
  fieldText,
  formeText,
  healText,
  itemText,
  missText,
  moveText,
  sideText,
  statusText,
  switchText,
  teamPreviewText,
  teraText,
  turnText,
  volatileText,
  weatherText,
  winText,
} from "./narrative.ts";
import { effectName, parseCondition, parseDetails, parsePokemonRef, parseSideId, protocolFrom } from "./protocol-text.ts";

const BOOSTS = new Set<BoostId>(["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"]);
const TERRAINS = new Set(["electricterrain", "grassyterrain", "mistyterrain", "psychicterrain"]);

function isBoost(value: string): value is BoostId {
  return BOOSTS.has(value as BoostId);
}

/** `0 fnt` has no denominator. The foe is on the percent scale; the viewer's last exact max is kept by the tracker. */
function reportedMax(pokemon: PokemonRef, condition: { maxHp: number }, viewer: SideId): number {
  if (condition.maxHp > 0) return condition.maxHp;
  return pokemon.side === viewer ? 0 : 100;
}

function winnerSide(name: string): SideId | null {
  if (name === "Player") return "p1";
  if (name === "CPU") return "p2";
  return null;
}

/**
 * Parse one viewer's channel lines into typed events.
 * Unknown lines are skipped. Nothing here throws because of protocol shape.
 */
export function parseProtocol(lines: readonly string[], viewer: SideId, formatId: FormatId): BattleEvent[] {
  const events: BattleEvent[] = [];
  const preview: Record<SideId, string[]> = { p1: [], p2: [] };
  const teraType = new Map<string, string>();
  const boosts = new Map<string, Partial<Record<BoostId, number>>>();
  const activeName: Record<SideId, string | null> = { p1: null, p2: null };
  let lastMove: Extract<BattleEvent, { kind: "move" }> | null = null;

  const monKey = (ref: PokemonRef) => `${ref.side}:${ref.name}`;

  const currentBoost = (ref: PokemonRef, stat: BoostId) => boosts.get(monKey(ref))?.[stat] ?? 0;

  const addBoost = (ref: PokemonRef, stat: BoostId, delta: number) => {
    const key = monKey(ref);
    const book = boosts.get(key) ?? {};
    const next = Math.max(-6, Math.min(6, (book[stat] ?? 0) + delta));
    book[stat] = next;
    boosts.set(key, book);
  };

  const rememberActive = (ref: PokemonRef) => {
    const previous = activeName[ref.side];
    if (previous && previous !== ref.name) boosts.delete(`${ref.side}:${previous}`);
    activeName[ref.side] = ref.name;
    if (!boosts.has(monKey(ref))) boosts.set(monKey(ref), {});
  };

  const emitBoost = (ref: PokemonRef, stat: BoostId, delta: number, text: string) => {
    if (delta === 0) return;
    addBoost(ref, stat, delta);
    events.push({ kind: "boost", pokemon: ref, stat, amount: delta, text });
  };

  for (const line of lines) {
    if (!line.startsWith("|") || line.startsWith("|t:")) continue;
    const parts = line.slice(1).split("|");
    const tag = parts[0] ?? "";

    if (tag === "poke") {
      const side = parseSideId(parts[1] ?? "");
      if (!side) continue;
      const species = parseDetails(parts[2] ?? "").species;
      if (species) preview[side].push(species);
      continue;
    }

    if (tag === "teampreview") {
      for (const side of ["p1", "p2"] as const) {
        if (preview[side].length === 0) continue;
        events.push({
          kind: "teamPreview",
          side,
          species: preview[side],
          text: teamPreviewText(side, viewer),
        });
      }
      continue;
    }

    if (tag === "switch" || tag === "drag" || tag === "replace") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      const details = parseDetails(parts[2] ?? "");
      const condition = parseCondition(parts[3] ?? "0/0");
      const maxHp = reportedMax(pokemon, condition, viewer);
      const cause = tag;
      rememberActive(pokemon);
      lastMove = null;
      events.push({
        kind: "switch",
        cause,
        pokemon,
        species: details.species,
        spriteId: spriteIdForSpecies(details.species),
        level: details.level,
        gender: details.gender,
        shiny: details.shiny,
        hp: condition.hp,
        maxHp,
        status: condition.explicitStatus ? condition.status : null,
        text: switchText(pokemon, viewer, cause),
      });
      continue;
    }

    if (tag === "move") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      const move = parts[2] ?? "";
      const target = parsePokemonRef(parts[3] ?? "");
      const missed = parts.some((part) => part === "[miss]");
      const failed = parts.some((part) => part === "[notarget]");
      const info = getMoveInfo(formatId, move);
      const moveEvent: Extract<BattleEvent, { kind: "move" }> = {
        kind: "move",
        pokemon,
        move: info.name,
        moveType: resolveMoveType(formatId, move, teraType.get(monKey(pokemon)) ?? null),
        category: info.category,
        flags: info.flags,
        target,
        missed,
        failed,
        text: moveText(pokemon, viewer, info.name),
      };
      events.push(moveEvent);
      lastMove = moveEvent;
      continue;
    }

    if (tag === "detailschange" || tag === "-formechange") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      const species = parseDetails(parts[2] ?? "").species;
      if (!species) continue;
      events.push({
        kind: "formeChange",
        pokemon,
        species,
        spriteId: spriteIdForSpecies(species),
        text: formeText(pokemon, viewer, species),
      });
      continue;
    }

    if (tag === "-damage" || tag === "-heal" || tag === "-sethp") {
      const pairs: Array<[string, string]> = [];
      if (tag === "-sethp") {
        for (let index = 1; index + 1 < parts.length; index += 2) {
          const pokemonToken = parts[index] ?? "";
          const conditionToken = parts[index + 1] ?? "";
          if (pokemonToken.startsWith("[")) break;
          pairs.push([pokemonToken, conditionToken]);
        }
      } else {
        pairs.push([parts[1] ?? "", parts[2] ?? ""]);
      }
      const from = protocolFrom(parts);
      for (const [pokemonToken, conditionToken] of pairs) {
        const pokemon = parsePokemonRef(pokemonToken);
        if (!pokemon) continue;
        const condition = parseCondition(conditionToken);
        const maxHp = reportedMax(pokemon, condition, viewer);
        if (tag === "-heal") {
          events.push({
            kind: "heal",
            pokemon,
            hp: condition.hp,
            maxHp,
            status: condition.status,
            from,
            text: healText(pokemon, viewer, from),
          });
        } else {
          events.push({
            kind: "damage",
            pokemon,
            hp: condition.hp,
            maxHp,
            status: condition.status,
            from,
            text: damageText(pokemon, viewer, from),
          });
        }
      }
      continue;
    }

    if (tag === "faint") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      if (activeName[pokemon.side] === pokemon.name) activeName[pokemon.side] = null;
      events.push({ kind: "faint", pokemon, text: faintText(pokemon, viewer) });
      continue;
    }

    if (tag === "-status") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const status = parts[2] ?? "";
      if (!pokemon || (status !== "brn" && status !== "par" && status !== "slp" && status !== "frz" && status !== "psn" && status !== "tox")) {
        continue;
      }
      events.push({ kind: "status", pokemon, status, text: statusText(pokemon, viewer, status) });
      continue;
    }

    if (tag === "-curestatus") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const status = parts[2] ?? "";
      if (!pokemon) continue;
      const cured: StatusId =
        status === "brn" || status === "par" || status === "slp" || status === "frz" || status === "psn" || status === "tox"
          ? status
          : "psn";
      events.push({ kind: "cureStatus", pokemon, status: cured, text: cureText(pokemon, viewer) });
      continue;
    }

    if (tag === "-cureteam") {
      const side = parseSideId(parts[1] ?? "");
      if (!side) continue;
      events.push({
        kind: "message",
        pokemon: null,
        text: side === viewer ? "Tu equipo se curó." : "El equipo rival se curó.",
      });
      // Empty name means the whole side. The engine hides this sentinel from the client log.
      events.push({ kind: "cureStatus", pokemon: { side, name: "" }, status: "psn", text: "" });
      continue;
    }

    if (tag === "-boost" || tag === "-unboost" || tag === "-setboost") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const stat = parts[2] ?? "";
      const amount = Number(parts[3] ?? "");
      if (!pokemon || !isBoost(stat) || !Number.isFinite(amount)) continue;
      if (tag === "-setboost") {
        const delta = amount - currentBoost(pokemon, stat);
        emitBoost(pokemon, stat, delta, boostText(pokemon, viewer, stat, delta));
      } else {
        const delta = tag === "-unboost" ? -Math.abs(amount) : amount;
        emitBoost(pokemon, stat, delta, boostText(pokemon, viewer, stat, delta));
      }
      continue;
    }

    if (tag === "-clearboost") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      boosts.delete(monKey(pokemon));
      events.push({ kind: "clearBoosts", pokemon, text: clearBoostText(pokemon, viewer) });
      continue;
    }

    if (tag === "-clearallboost") {
      boosts.clear();
      events.push({ kind: "clearBoosts", pokemon: null, text: clearBoostText(null, viewer) });
      continue;
    }

    if (tag === "-clearnegativeboost") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      const book = boosts.get(monKey(pokemon));
      events.push({
        kind: "message",
        pokemon,
        text: `Los cambios negativos de ${monSubjectSafe(pokemon, viewer)} desaparecieron.`,
      });
      if (book) {
        for (const stat of BOOSTS) {
          const value = book[stat] ?? 0;
          if (value < 0) emitBoost(pokemon, stat, -value, "");
        }
      }
      continue;
    }

    if (tag === "-weather") {
      const name = parts[1] ?? "";
      const upkeep = parts.some((part) => part === "[upkeep]");
      const weather = !name || name === "none" ? null : name;
      events.push({ kind: "weather", weather, upkeep, text: weatherText(weather, upkeep) });
      continue;
    }

    if (tag === "-fieldstart" || tag === "-fieldend") {
      const effect = effectName(parts[1]);
      if (!effect) continue;
      events.push({
        kind: tag === "-fieldstart" ? "fieldStart" : "fieldEnd",
        effect,
        text: fieldText(effect, tag === "-fieldend"),
      });
      continue;
    }

    if (tag === "-sidestart" || tag === "-sideend") {
      const side = parseSideId(parts[1] ?? "");
      const effect = effectName(parts[2]);
      if (!side || !effect) continue;
      events.push({
        kind: tag === "-sidestart" ? "sideStart" : "sideEnd",
        side,
        effect,
        text: sideText(side, viewer, effect, tag === "-sideend"),
      });
      continue;
    }

    if (tag === "-start" || tag === "-end") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const effect = effectName(parts[2]);
      if (!pokemon || !effect) continue;
      events.push({
        kind: tag === "-start" ? "volatileStart" : "volatileEnd",
        pokemon,
        effect,
        text: volatileText(pokemon, viewer, effect, tag === "-end"),
      });
      continue;
    }

    if (tag === "-crit") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      events.push({ kind: "crit", pokemon, text: critText() });
      continue;
    }

    if (tag === "-supereffective" || tag === "-resisted" || tag === "-immune") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      const value: EffectivenessValue =
        tag === "-supereffective" ? "super" : tag === "-resisted" ? "resisted" : "immune";
      events.push({ kind: "effectiveness", pokemon, value, text: effectivenessText(value, pokemon, viewer) });
      continue;
    }

    if (tag === "-miss") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (lastMove && pokemon && lastMove.pokemon.side === pokemon.side && lastMove.pokemon.name === pokemon.name) {
        lastMove.missed = true;
      }
      events.push({ kind: "message", pokemon, text: missText() });
      continue;
    }

    if (tag === "-fail") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (lastMove && pokemon && lastMove.pokemon.side === pokemon.side && lastMove.pokemon.name === pokemon.name) {
        lastMove.failed = true;
      }
      events.push({ kind: "message", pokemon, text: failText() });
      continue;
    }

    if (tag === "-terastallize") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const typeName = parts[2] ?? "";
      if (!pokemon || !typeName) continue;
      teraType.set(monKey(pokemon), typeName);
      events.push({ kind: "terastallize", pokemon, teraType: typeName, text: teraText(pokemon, viewer, typeName) });
      continue;
    }

    if (tag === "-ability") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const ability = effectName(parts[2]);
      if (!pokemon || !ability) continue;
      events.push({ kind: "ability", pokemon, ability, text: abilityText(pokemon, viewer, ability) });
      continue;
    }

    if (tag === "-item" || tag === "-enditem") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const item = effectName(parts[2]);
      if (!pokemon || !item) continue;
      const consumed = tag === "-enditem";
      events.push({ kind: "item", pokemon, item, consumed, text: itemText(pokemon, viewer, item, consumed) });
      continue;
    }

    if (tag === "cant") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      if (!pokemon) continue;
      events.push({ kind: "message", pokemon, text: cantText(pokemon, viewer) });
      continue;
    }

    if (tag === "-activate") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const effect = effectName(parts[2]);
      if (!pokemon || !effect) continue;
      events.push({ kind: "message", pokemon, text: activateText(pokemon, viewer, effect) });
      continue;
    }

    if (tag === "turn") {
      const turn = Number(parts[1] ?? "");
      if (!Number.isInteger(turn)) continue;
      lastMove = null;
      events.push({ kind: "turn", turn, text: turnText(turn) });
      continue;
    }

    if (tag === "win") {
      const winner = winnerSide(parts[1] ?? "");
      events.push({ kind: "win", winner, text: winText(winner, viewer) });
      continue;
    }

    if (tag === "tie") {
      events.push({ kind: "win", winner: null, text: winText(null, viewer) });
      continue;
    }

    if (
      tag === "-hint" ||
      tag === "start" ||
      tag === "upkeep" ||
      tag === "-anim" ||
      tag === "debug" ||
      tag === "player" ||
      tag === "gametype" ||
      tag === "gen" ||
      tag === "tier" ||
      tag === "rule" ||
      tag === "clearpoke" ||
      tag === "teamsize" ||
      tag === ""
    ) {
      continue;
    }

    if (tag === "-prepare" || tag === "-mustrecharge" || tag === "-hitcount" || tag === "-singleturn" || tag === "-singlemove" || tag === "-block") {
      const pokemon = parsePokemonRef(parts[1] ?? "");
      const detail = effectName(parts[2]);
      let text = "Sucede algo en el campo.";
      if (tag === "-prepare" && pokemon) text = `¡${monSubjectSafe(pokemon, viewer)} se está concentrando!`;
      else if (tag === "-mustrecharge" && pokemon) text = `¡${monSubjectSafe(pokemon, viewer)} debe recargar!`;
      else if (tag === "-hitcount") text = `Golpeó ${parts[2] ?? ""} veces.`;
      else if (tag === "-block" && pokemon) text = `¡${monSubjectSafe(pokemon, viewer)} lo bloqueó!`;
      else if (pokemon && detail) text = activateText(pokemon, viewer, detail);
      events.push({ kind: "message", pokemon, text });
      continue;
    }

  }

  return events;
}

/** Drop internal sentinels that exist only so the state tracker can see a side-wide cure. */
export function presentEvents(events: readonly BattleEvent[]): BattleEvent[] {
  return events.filter((event) => !(event.kind === "cureStatus" && event.pokemon.name === ""));
}

function monSubjectSafe(ref: PokemonRef, viewer: SideId): string {
  return ref.side === viewer ? ref.name : `El ${ref.name} rival`;
}

export { TERRAINS };
