import type { BoostId, EffectivenessValue, MoveCategory, StatusId } from "@/shared/contract";

/** Showdown id: lowercase alphanumeric, so "Electric Terrain" and "electricterrain" match. */
export function toAssetId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const CRIT_TEXT = "¡Golpe crítico!";

export const EFFECTIVENESS_TEXT: Record<EffectivenessValue, string> = {
  super: "¡Es muy eficaz!",
  resisted: "No es muy eficaz…",
  immune: "No afecta…",
};

export const STAT_LABELS_ES: Record<BoostId, string> = {
  atk: "Ataque",
  def: "Defensa",
  spa: "At. Esp.",
  spd: "Def. Esp.",
  spe: "Velocidad",
  accuracy: "Precisión",
  evasion: "Evasión",
};

export const STATUS_LABELS_ES: Record<StatusId, string> = {
  brn: "Quemadura",
  par: "Parálisis",
  slp: "Dormido",
  frz: "Congelado",
  psn: "Veneno",
  tox: "Veneno grave",
};

export const STATUS_COLORS: Record<StatusId, string> = {
  brn: "var(--color-status-brn)",
  par: "var(--color-status-par)",
  slp: "var(--color-status-slp)",
  frz: "var(--color-status-frz)",
  psn: "var(--color-status-psn)",
  tox: "var(--color-status-tox)",
};

export type MoveFxMode = "lunge" | "projectile" | "aura";

export interface MoveFxPlan {
  images: string[];
  mode: MoveFxMode;
  shake: boolean;
  filter?: string;
}

interface TypeCell {
  physical: string[];
  special: string[];
  status: string[];
  specialFilter?: string;
}

/**
 * Flags win over type, then category.
 * Filenames are stems; the player drops any stem missing from `index.fx`.
 * Fighting's "ring" is not shipped, so special Fighting uses shine.
 */
const TYPE_FX: Record<string, TypeCell> = {
  normal: { physical: ["impact", "hitmarker"], special: ["shine"], status: ["stare"] },
  fire: { physical: ["flareball", "impact"], special: ["fireball"], status: ["bluefireball", "wisp"] },
  water: { physical: ["waterwisp", "impact"], special: ["waterwisp"], status: ["waterwisp"] },
  electric: { physical: ["lightning", "impact"], special: ["electroball", "lightning"], status: ["electroball"] },
  grass: { physical: ["leaf1", "leaf2"], special: ["energyball"], status: ["petal"] },
  ice: { physical: ["icicle"], special: ["iceball"], status: ["icicle-pink"] },
  fighting: { physical: ["fist", "foot", "leftchop", "rightchop"], special: ["impact", "shine"], status: ["angry"] },
  poison: { physical: ["poisonwisp", "impact"], special: ["poisonwisp"], status: ["poisoncaltrop"] },
  ground: { physical: ["rock1", "rock2", "rock3", "mudwisp"], special: ["mudwisp"], status: ["mudwisp"] },
  flying: { physical: ["feather"], special: ["feather", "wisp"], status: ["feather"] },
  psychic: { physical: ["impact", "mistball"], special: ["mistball"], status: ["stare"] },
  bug: { physical: ["leftslash", "impact"], special: ["sound", "energyball"], status: ["web"], specialFilter: "hue-rotate(80deg)" },
  rock: { physical: ["rock1", "rock2", "rock3"], special: ["shine"], status: ["rocks"] },
  ghost: { physical: ["leftclaw", "purplewisp"], special: ["shadowball"], status: ["blackwisp"] },
  dragon: { physical: ["leftclaw", "rightclaw"], special: ["mistball"], status: ["shine"], specialFilter: "hue-rotate(240deg)" },
  dark: { physical: ["topbite", "bottombite", "leftslash"], special: ["blackwisp"], status: ["stare", "angry"] },
  steel: { physical: ["gear", "greenmetal1", "greenmetal2"], special: ["shine", "gear"], status: ["greenmetal1"] },
  fairy: { physical: ["heart", "impact"], special: ["moon", "rainbow", "mistball"], status: ["heart"], specialFilter: "hue-rotate(300deg)" },
  stellar: { physical: ["rainbow", "shine"], special: ["rainbow", "shine"], status: ["rainbow", "shine"] },
};

const FALLBACK_CELL: TypeCell = { physical: ["impact"], special: ["shine"], status: ["stare"] };

function cellFor(typeId: string): TypeCell {
  return TYPE_FX[typeId] ?? FALLBACK_CELL;
}

export function moveFxPlan(input: { moveType: string; category: MoveCategory; flags: readonly string[] }): MoveFxPlan {
  const flags = new Set(input.flags.map((flag) => toAssetId(flag)));
  const typeId = toAssetId(input.moveType);
  const cell = cellFor(typeId);
  const shake = typeId === "ground" && input.category === "Physical";

  if (flags.has("bite")) return { images: ["topbite", "bottombite"], mode: "lunge", shake: false };
  if (flags.has("punch")) return { images: ["fist", "fist1"], mode: "lunge", shake: false };
  if (flags.has("slicing")) return { images: ["leftslash", "rightslash"], mode: "lunge", shake: false };
  if (flags.has("sound")) {
    return { images: ["sound"], mode: input.category === "Status" ? "aura" : "projectile", shake: false };
  }
  if (flags.has("bullet")) {
    const images = input.category === "Physical" ? cell.physical : cell.special;
    return { images, mode: "projectile", shake: false, filter: cell.specialFilter };
  }
  if (input.category === "Status") return { images: cell.status, mode: "aura", shake: false };
  if (flags.has("contact") && input.category !== "Physical") return { images: ["impact"], mode: "lunge", shake: false };
  if (input.category === "Physical") return { images: cell.physical, mode: "lunge", shake, filter: undefined };
  return { images: cell.special, mode: "projectile", shake: false, filter: cell.specialFilter };
}

const WEATHER_FILES: Record<string, string> = {
  raindance: "weather-raindance.jpg",
  primordialsea: "weather-raindance.jpg",
  sunnyday: "weather-sunnyday.jpg",
  desolateland: "weather-sunnyday.jpg",
  sandstorm: "weather-sandstorm.png",
  snow: "weather-hail.png",
  hail: "weather-hail.png",
  deltastream: "weather-strongwind.png",
};

const TERRAIN_FILES: Record<string, string> = {
  electricterrain: "weather-electricterrain.png",
  grassyterrain: "weather-grassyterrain.png",
  mistyterrain: "weather-mistyterrain.png",
  psychicterrain: "weather-psychicterrain.png",
};

const PSEUDO_FILES: Record<string, string> = {
  trickroom: "weather-trickroom.png",
  magicroom: "weather-magicroom.png",
  wonderroom: "weather-wonderroom.png",
  gravity: "weather-gravity.png",
};

const WEATHER_TINTS: Record<string, string> = {
  raindance: "rgba(41, 128, 239, 0.42)",
  primordialsea: "rgba(41, 128, 239, 0.5)",
  sunnyday: "rgba(255, 200, 61, 0.38)",
  desolateland: "rgba(230, 40, 41, 0.4)",
  sandstorm: "rgba(196, 160, 90, 0.42)",
  snow: "rgba(238, 242, 255, 0.38)",
  hail: "rgba(108, 199, 232, 0.42)",
  deltastream: "rgba(79, 209, 255, 0.36)",
};

const FIELD_TINTS: Record<string, string> = {
  electricterrain: "rgba(250, 192, 0, 0.4)",
  grassyterrain: "rgba(63, 161, 41, 0.4)",
  mistyterrain: "rgba(239, 112, 239, 0.34)",
  psychicterrain: "rgba(239, 65, 121, 0.38)",
  trickroom: "rgba(80, 96, 225, 0.42)",
  magicroom: "rgba(145, 65, 203, 0.4)",
  wonderroom: "rgba(239, 65, 121, 0.34)",
  gravity: "rgba(145, 81, 33, 0.42)",
};

const HAZARDS: Record<string, string> = {
  stealthrock: "rocks",
  spikes: "caltrop",
  toxicspikes: "poisoncaltrop",
  stickyweb: "web",
};

export function weatherOverlayFile(weather: string | null): string | null {
  if (!weather) return null;
  return WEATHER_FILES[toAssetId(weather)] ?? null;
}

export function terrainOverlayFile(terrain: string | null): string | null {
  if (!terrain) return null;
  return TERRAIN_FILES[toAssetId(terrain)] ?? null;
}

export function pseudoOverlayFile(name: string): string | null {
  return PSEUDO_FILES[toAssetId(name)] ?? null;
}

export function weatherTint(weather: string): string | null {
  return WEATHER_TINTS[toAssetId(weather)] ?? null;
}

export function fieldTint(effect: string): string | null {
  return FIELD_TINTS[toAssetId(effect)] ?? null;
}

export function hazardParticle(effect: string): string | null {
  return HAZARDS[toAssetId(effect)] ?? null;
}
