import "server-only";
import type { BoostId, EffectivenessValue, PokemonRef, SideId } from "../../shared/contract/index.ts";

const STAT_ES: Record<BoostId, string> = {
  atk: "ataque",
  def: "defensa",
  spa: "ataque especial",
  spd: "defensa especial",
  spe: "velocidad",
  accuracy: "precisión",
  evasion: "evasión",
};

export function monSubject(ref: PokemonRef, viewer: SideId): string {
  if (ref.side === viewer) return ref.name;
  return `El ${ref.name} rival`;
}

export function monObject(ref: PokemonRef, viewer: SideId): string {
  if (ref.side === viewer) return ref.name;
  return `el ${ref.name} rival`;
}

export function turnText(turn: number): string {
  return `¡Turno ${turn}!`;
}

export function teamPreviewText(side: SideId, viewer: SideId): string {
  return side === viewer ? "Se revela tu equipo." : "Se revela el equipo rival.";
}

export function switchText(ref: PokemonRef, viewer: SideId, cause: "switch" | "drag" | "replace"): string {
  const subject = monSubject(ref, viewer);
  if (cause === "drag") return `¡${subject} fue arrastrado al combate!`;
  if (cause === "replace") return `¡${subject} se quitó el disfraz!`;
  if (ref.side === viewer) return `¡Adelante, ${ref.name}!`;
  return `¡${subject} entra en combate!`;
}

export function moveText(ref: PokemonRef, viewer: SideId, move: string): string {
  return `¡${monSubject(ref, viewer)} usó ${move}!`;
}

export function faintText(ref: PokemonRef, viewer: SideId): string {
  if (ref.side === viewer) return `¡${ref.name} se debilitó!`;
  return `El ${ref.name} rival se debilitó.`;
}

export function statusText(ref: PokemonRef, viewer: SideId, status: string): string {
  const subject = monSubject(ref, viewer);
  switch (status) {
    case "brn":
      return `¡${subject} se ha quemado!`;
    case "par":
      return `¡${subject} está paralizado!`;
    case "slp":
      return `¡${subject} se ha dormido!`;
    case "frz":
      return `¡${subject} se ha congelado!`;
    case "tox":
      return `¡${subject} ha sido gravemente envenenado!`;
    default:
      return `¡${subject} ha sido envenenado!`;
  }
}

export function cureText(ref: PokemonRef, viewer: SideId): string {
  return `¡${monSubject(ref, viewer)} se curó!`;
}

export function boostText(ref: PokemonRef, viewer: SideId, stat: BoostId, amount: number): string {
  const name = STAT_ES[stat];
  const subject = monObject(ref, viewer);
  const magnitude = Math.abs(amount);
  const degree = magnitude >= 3 ? " muchísimo" : magnitude === 2 ? " mucho" : "";
  if (amount >= 0) return `¡El ${name} de ${subject} subió${degree}!`;
  return `¡El ${name} de ${subject} bajó${degree}!`;
}

export function clearBoostText(ref: PokemonRef | null, viewer: SideId): string {
  if (!ref) return "Se eliminaron los cambios de estadísticas.";
  return `${monSubject(ref, viewer)} vuelve a sus estadísticas normales.`;
}

const WEATHER_START: Record<string, string> = {
  raindance: "Empieza a llover.",
  sunnyday: "El sol brilla con fuerza.",
  sandstorm: "Se levanta una tormenta de arena.",
  snow: "Empieza a nevar.",
  hail: "Empieza a granizar.",
  primordialsea: "Empieza un diluvio.",
  desolateland: "El sol se vuelve abrasador.",
  deltastream: "Aparecen corrientes de aire misteriosas.",
};

const WEATHER_UPKEEP: Record<string, string> = {
  raindance: "Sigue lloviendo.",
  sunnyday: "El sol sigue brillando.",
  sandstorm: "La tormenta de arena continúa.",
  snow: "Sigue nevando.",
  hail: "Sigue granizando.",
  primordialsea: "El diluvio continúa.",
  desolateland: "El sol abrasador continúa.",
  deltastream: "Las corrientes de aire continúan.",
};

export function weatherText(weather: string | null, upkeep: boolean): string {
  if (!weather) return "El tiempo se despeja.";
  const key = weather.toLowerCase().replace(/[^a-z0-9]/g, "");
  const table = upkeep ? WEATHER_UPKEEP : WEATHER_START;
  return table[key] ?? (upkeep ? "El clima continúa." : `El clima cambió a ${weather}.`);
}

const FIELD_START: Record<string, string> = {
  electricterrain: "El campo se ha electrificado.",
  grassyterrain: "El campo se ha cubierto de hierba.",
  mistyterrain: "La niebla cubre el campo.",
  psychicterrain: "El campo se ha vuelto extraño.",
  trickroom: "¡Las dimensiones se han alterado!",
  gravity: "¡La gravedad se intensifica!",
  magicroom: "¡Se crea una dimensión mágica!",
  wonderroom: "¡Se crea una dimensión extraña!",
};

export function fieldText(effect: string, ending: boolean): string {
  const key = effect.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ending) return `El efecto ${effect} terminó.`;
  return FIELD_START[key] ?? `El campo está bajo el efecto de ${effect}.`;
}

export function sideText(side: SideId, viewer: SideId, effect: string, ending: boolean): string {
  const key = effect.toLowerCase().replace(/[^a-z0-9]/g, "");
  const own = side === viewer;
  if (!ending && key === "stealthrock") {
    return own
      ? "¡Piedras puntiagudas flotan alrededor de tu equipo!"
      : "¡Piedras puntiagudas flotan alrededor del equipo rival!";
  }
  if (!ending && key === "spikes") return own ? "¡Púas cubren a tu equipo!" : "¡Púas cubren al equipo rival!";
  if (!ending && key === "toxicspikes") {
    return own ? "¡Púas tóxicas cubren a tu equipo!" : "¡Púas tóxicas cubren al equipo rival!";
  }
  if (!ending && key === "stickyweb") {
    return own ? "¡Una red viscosa cubre a tu equipo!" : "¡Una red viscosa cubre al equipo rival!";
  }
  const who = own ? "Tu equipo" : "El equipo rival";
  if (ending) return `${who} ya no está bajo ${effect}.`;
  return `${who} queda bajo ${effect}.`;
}

export function volatileText(ref: PokemonRef, viewer: SideId, effect: string, ending: boolean): string {
  const subject = monSubject(ref, viewer);
  if (ending) return `${subject} ya no está afectado por ${effect}.`;
  return `¡${subject} está afectado por ${effect}!`;
}

export function critText(): string {
  return "¡Golpe crítico!";
}

export function effectivenessText(value: EffectivenessValue, ref: PokemonRef, viewer: SideId): string {
  if (value === "super") return "¡Es muy eficaz!";
  if (value === "resisted") return "No es muy eficaz...";
  return `No afecta a ${monObject(ref, viewer)}.`;
}

export function missText(): string {
  return "¡El ataque falló!";
}

export function failText(): string {
  return "Pero falló.";
}

export function teraText(ref: PokemonRef, viewer: SideId, teraType: string): string {
  return `¡${monSubject(ref, viewer)} teracristalizó al tipo ${teraType}!`;
}

export function abilityText(ref: PokemonRef, viewer: SideId, ability: string): string {
  return `¡${monSubject(ref, viewer)} usó ${ability}!`;
}

export function itemText(ref: PokemonRef, viewer: SideId, item: string, consumed: boolean): string {
  const subject = monSubject(ref, viewer);
  if (consumed) return `¡${subject} consumió ${item}!`;
  return `¡${subject} tiene ${item}!`;
}

export function formeText(ref: PokemonRef, viewer: SideId, species: string): string {
  return `¡${monSubject(ref, viewer)} se transformó en ${species}!`;
}

export function cantText(ref: PokemonRef, viewer: SideId): string {
  return `¡${monSubject(ref, viewer)} no puede moverse!`;
}

export function activateText(ref: PokemonRef, viewer: SideId, effect: string): string {
  const key = effect.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "protect" || key === "detect" || key === "spikyshield" || key === "banefulbunker") {
    return `¡${monSubject(ref, viewer)} se ha protegido!`;
  }
  return `¡${effect} de ${monObject(ref, viewer)} se activó!`;
}

export function winText(winner: SideId | null, viewer: SideId): string {
  if (!winner) return "La batalla terminó en empate.";
  if (winner === viewer) return "¡Has ganado!";
  return "Has perdido.";
}

export function damageText(ref: PokemonRef, viewer: SideId, from: string | null): string {
  if (!from) return "";
  const subject = monSubject(ref, viewer);
  const object = monObject(ref, viewer);
  const key = from.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "brn" || key === "burn") return `${subject} sufre por su quemadura.`;
  if (key === "psn" || key === "tox" || key === "poison") return `${subject} sufre por el veneno.`;
  if (key === "sandstorm") return `${subject} sufre por la tormenta de arena.`;
  if (key === "hail" || key === "snow") return `${subject} sufre por el clima.`;
  if (key === "stealthrock") return `¡Las piedras puntiagudas dañaron a ${object}!`;
  if (key === "spikes") return `¡Las púas dañaron a ${object}!`;
  if (key === "recoil") return `${subject} se dañó por el retroceso.`;
  if (key === "lifeorb") return `${subject} pierde salud por Life Orb.`;
  return `${subject} recibe daño de ${from}.`;
}

export function healText(ref: PokemonRef, viewer: SideId, from: string | null): string {
  const subject = monSubject(ref, viewer);
  if (!from) return `¡${subject} recuperó salud!`;
  return `¡${subject} recuperó salud con ${from}!`;
}
