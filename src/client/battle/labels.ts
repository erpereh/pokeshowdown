import type { BoostId, StatusId } from "@/shared/contract";

export function effectId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TERRAINS = new Set(["electricterrain", "grassyterrain", "mistyterrain", "psychicterrain"]);

export function isTerrain(effect: string): boolean {
  return TERRAINS.has(effectId(effect));
}

export const WEATHER_ES: Record<string, string> = {
  raindance: "Lluvia",
  sunnyday: "Sol",
  sandstorm: "Tormenta de arena",
  snow: "Nieve",
  snowscape: "Nieve",
  hail: "Granizo",
  primordialsea: "Diluvio",
  desolateland: "Sol abrasador",
  deltastream: "Turbulencias",
};

export const TERRAIN_ES: Record<string, string> = {
  electricterrain: "Campo eléctrico",
  grassyterrain: "Campo de hierba",
  mistyterrain: "Campo de niebla",
  psychicterrain: "Campo psíquico",
};

export const PSEUDO_ES: Record<string, string> = {
  trickroom: "Espacio raro",
  magicroom: "Espacio mágico",
  wonderroom: "Espacio extraño",
  gravity: "Gravedad",
};

export const SIDE_CONDITION_ES: Record<string, string> = {
  stealthrock: "Trampa rocas",
  spikes: "Púas",
  toxicspikes: "Púas tóxicas",
  stickyweb: "Red viscosa",
  reflect: "Reflejo",
  lightscreen: "Pantalla de luz",
  auroraveil: "Velo aurora",
  safeguard: "Velo sagrado",
  mist: "Neblina",
  tailwind: "Viento afín",
  luckychant: "Conjuro",
};

export const BOOST_SHORT: Record<BoostId, string> = {
  atk: "Atq",
  def: "Def",
  spa: "At.E",
  spd: "Df.E",
  spe: "Vel",
  accuracy: "Pre",
  evasion: "Eva",
};

export const VOLATILE_ES: Record<string, string> = {
  substitute: "Sustituto",
  confusion: "Confusión",
  leechseed: "Drenadoras",
  taunt: "Mofa",
  encore: "Otra vez",
  disable: "Anulación",
  torment: "Tormento",
  ingrain: "Arraigo",
  aquaring: "Acua aro",
  charge: "Carga",
  protect: "Protección",
};

export function fieldLabel(kind: "weather" | "terrain" | "pseudo", raw: string): string {
  const key = effectId(raw);
  if (kind === "weather") return WEATHER_ES[key] ?? raw;
  if (kind === "terrain") return TERRAIN_ES[key] ?? raw;
  return PSEUDO_ES[key] ?? raw;
}

export function sideConditionLabel(id: string, name: string): string {
  return SIDE_CONDITION_ES[effectId(id)] ?? SIDE_CONDITION_ES[effectId(name)] ?? name;
}

export function genderMark(gender: "M" | "F" | "N"): string | null {
  if (gender === "M") return "♂";
  if (gender === "F") return "♀";
  return null;
}

export function statusName(status: StatusId): string {
  switch (status) {
    case "brn":
      return "Quemado";
    case "par":
      return "Paralizado";
    case "psn":
      return "Envenenado";
    case "tox":
      return "Intoxicado";
    case "slp":
      return "Dormido";
    case "frz":
      return "Congelado";
    default:
      return status;
  }
}
