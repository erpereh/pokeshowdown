"use client";

import { useEffect, useState } from "react";

/** Public root for synced Showdown files. Matches `runtime-index.json` `base`. */
export const ASSET_BASE = "/assets/generated";

export const DEFAULT_SPRITE_SIZE = 96;

export const ITEM_ICON_COLUMNS = 16;
export const ITEM_ICON_CELL = 24;
export const ITEM_SHEET_WIDTH = ITEM_ICON_COLUMNS * ITEM_ICON_CELL;
export const ITEM_SHEET_HEIGHT = 1152;

const DEFAULT_BITS = [
  "ani",
  "ani-back",
  "gen5",
  "gen5-back",
  "gen5-shiny",
  "gen5-back-shiny",
  "ani-shiny",
  "ani-back-shiny",
] as const;

const SPRITE_EXT: Record<string, string> = {
  ani: "gif",
  "ani-back": "gif",
  "ani-shiny": "gif",
  "ani-back-shiny": "gif",
  gen5: "png",
  "gen5-back": "png",
  "gen5-shiny": "png",
  "gen5-back-shiny": "png",
};

const TYPE_ICON_STEMS = [
  "Bug",
  "Dark",
  "Dragon",
  "Electric",
  "Fairy",
  "Fighting",
  "Fire",
  "Flying",
  "Ghost",
  "Grass",
  "Ground",
  "Ice",
  "Normal",
  "Poison",
  "Psychic",
  "Rock",
  "Steel",
  "Stellar",
  "Water",
] as const;

export interface RuntimeIndex {
  v: 1;
  engine: string;
  base: string;
  bits: readonly string[];
  /** id → [bitmask, frontW, frontH, backW, backH] */
  sprites: Record<string, readonly [number, number, number, number, number]>;
  backgrounds: readonly string[];
  fx: readonly string[];
  types: readonly string[];
}

export interface SpriteResolveOptions {
  spriteId: string;
  /** Defaults to front. Back is the player's side in battle. */
  facing?: "front" | "back";
  shiny?: boolean;
  gender?: "M" | "F" | "N";
  /** When false, only static gen5 frames are returned. Defaults to true. */
  animated?: boolean;
}

export interface ResolvedSprite {
  urls: string[];
  width: number;
  height: number;
}

export interface ItemSpriteStyle {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: "no-repeat";
  backgroundSize: string;
  width: string;
  height: string;
}

type SpriteEntry = readonly [number, number, number, number, number];

const FACING_BITS = {
  front: { shinyAni: "ani-shiny", shinyStatic: "gen5-shiny", ani: "ani", static: "gen5" },
  back: { shinyAni: "ani-back-shiny", shinyStatic: "gen5-back-shiny", ani: "ani-back", static: "gen5-back" },
} as const;

let cachedIndex: RuntimeIndex | null = null;
let pendingIndex: Promise<RuntimeIndex> | null = null;

export function emptyRuntimeIndex(): RuntimeIndex {
  return {
    v: 1,
    engine: "",
    base: ASSET_BASE,
    bits: DEFAULT_BITS,
    sprites: {},
    backgrounds: [],
    fx: [],
    types: [],
  };
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asEntry(value: unknown): SpriteEntry | null {
  if (!Array.isArray(value) || value.length < 5) return null;
  const nums = value.slice(0, 5).map((part) => (typeof part === "number" && Number.isFinite(part) ? part : Number.NaN));
  if (nums.some((part) => Number.isNaN(part))) return null;
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 0, nums[4] ?? 0];
}

export function normalizeRuntimeIndex(value: unknown): RuntimeIndex {
  if (!value || typeof value !== "object") return emptyRuntimeIndex();
  const raw = value as Partial<RuntimeIndex>;
  const bits = Array.isArray(raw.bits) && raw.bits.every((bit) => typeof bit === "string") ? raw.bits : [...DEFAULT_BITS];
  const sprites: RuntimeIndex["sprites"] = {};
  if (raw.sprites && typeof raw.sprites === "object") {
    for (const [id, entry] of Object.entries(raw.sprites)) {
      const parsed = asEntry(entry);
      if (parsed) sprites[id] = parsed;
    }
  }
  const base = typeof raw.base === "string" && raw.base.startsWith("/") ? raw.base.replace(/\/$/, "") : ASSET_BASE;
  return {
    v: 1,
    engine: typeof raw.engine === "string" ? raw.engine : "",
    base,
    bits,
    sprites,
    backgrounds: asStringList(raw.backgrounds),
    fx: asStringList(raw.fx),
    types: asStringList(raw.types),
  };
}

/**
 * Cache successful loads only. A transient failure renders placeholders and may be
 * retried when connectivity returns or the page becomes visible again.
 */
export function loadRuntimeIndex(): Promise<RuntimeIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (!pendingIndex) {
    pendingIndex = fetch(`${ASSET_BASE}/runtime-index.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`runtime index ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        cachedIndex = normalizeRuntimeIndex(payload);
        return cachedIndex;
      })
      .catch(() => {
        return emptyRuntimeIndex();
      })
      .finally(() => {
        pendingIndex = null;
      });
  }
  return pendingIndex;
}

export function useRuntimeIndex(): RuntimeIndex | null {
  const [index, setIndex] = useState<RuntimeIndex | null>(cachedIndex);
  useEffect(() => {
    let active = true;
    function load() {
      void loadRuntimeIndex().then((value) => {
        if (active) setIndex(value);
      });
    }
    function onVisible() {
      if (document.visibilityState === "visible" && !cachedIndex) load();
    }
    load();
    window.addEventListener("online", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("online", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return index;
}

function assetUrl(index: RuntimeIndex, ...parts: string[]): string {
  const base = index.base.replace(/\/$/, "") || ASSET_BASE;
  return [base, ...parts.map((part) => encodeURIComponent(part))].join("/");
}

function hasBit(index: RuntimeIndex, mask: number, bit: string): boolean {
  const bitIndex = index.bits.indexOf(bit);
  if (bitIndex < 0) return false;
  return (mask & (1 << bitIndex)) !== 0;
}

function spriteUrl(index: RuntimeIndex, id: string, bit: string): string | null {
  const ext = SPRITE_EXT[bit];
  if (!ext) return null;
  return assetUrl(index, "sprites", bit, `${id}.${ext}`);
}

function entryDims(entry: SpriteEntry | undefined, facing: "front" | "back"): { width: number; height: number } | null {
  if (!entry) return null;
  const width = facing === "back" ? entry[3] : entry[1];
  const height = facing === "back" ? entry[4] : entry[2];
  if (width > 0 && height > 0) return { width, height };
  if (entry[1] > 0 && entry[2] > 0) return { width: entry[1], height: entry[2] };
  return null;
}

function variantUrls(index: RuntimeIndex, id: string, options: SpriteResolveOptions): string[] {
  const entry = index.sprites[id];
  if (!entry) return [];
  const bits = FACING_BITS[options.facing ?? "front"];
  const animated = options.animated !== false;
  const order: string[] = [];
  if (options.shiny && animated) order.push(bits.shinyAni);
  if (options.shiny) order.push(bits.shinyStatic);
  if (animated) order.push(bits.ani);
  order.push(bits.static);
  const urls: string[] = [];
  for (const bit of order) {
    if (!hasBit(index, entry[0], bit)) continue;
    const url = spriteUrl(index, id, bit);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/**
 * Ordered image fallbacks. Female `-f` (when that id is in the index) is tried first,
 * then the given id, then `spriteId` before the first hyphen. Missing bits are skipped.
 * The component advances one step on error; this list is not cyclic.
 */
export function resolveSpriteUrls(index: RuntimeIndex, options: SpriteResolveOptions): ResolvedSprite {
  const spriteId = options.spriteId.trim().toLowerCase();
  const ids: string[] = [];
  if (spriteId && options.gender === "F") {
    const femaleId = `${spriteId}-f`;
    if (index.sprites[femaleId]) ids.push(femaleId);
  }
  if (spriteId && !ids.includes(spriteId)) ids.push(spriteId);
  const baseId = spriteId.split("-")[0] ?? "";
  if (baseId && !ids.includes(baseId) && index.sprites[baseId]) ids.push(baseId);

  const urls: string[] = [];
  let sizedFrom: string | null = null;
  for (const id of ids) {
    for (const url of variantUrls(index, id, options)) {
      if (!urls.includes(url)) urls.push(url);
      if (!sizedFrom) sizedFrom = id;
    }
  }

  const facing = options.facing ?? "front";
  const size =
    entryDims(sizedFrom ? index.sprites[sizedFrom] : undefined, facing) ??
    entryDims(index.sprites[ids[0] ?? ""], facing) ??
    null;

  return {
    urls,
    width: size?.width ?? DEFAULT_SPRITE_SIZE,
    height: size?.height ?? DEFAULT_SPRITE_SIZE,
  };
}

function safeFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  return trimmed;
}

function matchFile(files: readonly string[], name: string): string | null {
  const trimmed = safeFileName(name);
  if (!trimmed) return null;
  const direct = files.find((file) => file.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  const stem = trimmed.replace(/\.(png|jpe?g|gif|webp)$/i, "").toLowerCase();
  return files.find((file) => file.replace(/\.[^.]+$/, "").toLowerCase() === stem) ?? null;
}

function indexOrCached(value: RuntimeIndex | string): { index: RuntimeIndex | null; name: string } {
  if (typeof value === "string") return { index: cachedIndex, name: value };
  return { index: value, name: "" };
}

export function backgroundUrl(file: string): string;
export function backgroundUrl(index: RuntimeIndex, file: string): string | null;
export function backgroundUrl(indexOrFile: RuntimeIndex | string, file?: string): string | null {
  if (typeof indexOrFile === "string") {
    const safe = safeFileName(indexOrFile);
    if (!safe) return "";
    const listed = cachedIndex ? matchFile(cachedIndex.backgrounds, safe) : null;
    const base = (cachedIndex?.base ?? ASSET_BASE).replace(/\/$/, "");
    return `${base}/sprites/gen6bgs/${encodeURIComponent(listed ?? safe)}`;
  }
  const match = matchFile(indexOrFile.backgrounds, file ?? "");
  if (!match) return null;
  return assetUrl(indexOrFile, "sprites", "gen6bgs", match);
}

/** `name` is an fx stem (`impact`) or filename (`impact.png`). Null when the index has no such file. */
export function fxUrl(name: string): string | null;
export function fxUrl(index: RuntimeIndex, name: string): string | null;
export function fxUrl(indexOrName: RuntimeIndex | string, name?: string): string | null {
  const { index, name: onlyName } = indexOrCached(indexOrName);
  const requested = typeof indexOrName === "string" ? onlyName : (name ?? "");
  if (!index) return null;
  const match = matchFile(index.fx, requested);
  if (!match) return null;
  return assetUrl(index, "fx", match);
}

export function typeFileStem(type: string): string {
  const id = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!id) return "";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function typeIconUrl(type: string): string | null;
export function typeIconUrl(index: RuntimeIndex, type: string): string | null;
export function typeIconUrl(indexOrType: RuntimeIndex | string, type?: string): string | null {
  const index = typeof indexOrType === "string" ? cachedIndex : indexOrType;
  const requested = typeof indexOrType === "string" ? indexOrType : (type ?? "");
  const stem = typeFileStem(requested);
  if (!TYPE_ICON_STEMS.includes(stem as (typeof TYPE_ICON_STEMS)[number])) return null;
  const base = index?.base ?? ASSET_BASE;
  return `${base.replace(/\/$/, "")}/sprites/typeicons/${stem}.png`;
}

export function teraIconUrl(type: string): string | null;
export function teraIconUrl(index: RuntimeIndex, type: string): string | null;
export function teraIconUrl(indexOrType: RuntimeIndex | string, type?: string): string | null {
  const index = typeof indexOrType === "string" ? null : indexOrType;
  const requested = typeof indexOrType === "string" ? indexOrType : (type ?? "");
  const stem = typeFileStem(requested);
  if (!stem) return null;
  const file = `Tera${stem}.png`;
  if (index) {
    if (!index.types.some((entry) => entry.toLowerCase() === file.toLowerCase())) return null;
    return assetUrl(index, "sprites", "types", file);
  }
  if (!TYPE_ICON_STEMS.includes(stem as (typeof TYPE_ICON_STEMS)[number])) return null;
  const base = cachedIndex?.base ?? ASSET_BASE;
  return `${base.replace(/\/$/, "")}/sprites/types/${file}`;
}

function buildItemStyle(index: RuntimeIndex | null, spriteNum: number): ItemSpriteStyle {
  const base = (index?.base ?? ASSET_BASE).replace(/\/$/, "");
  const n = Math.floor(spriteNum);
  const safe = Number.isFinite(n) && n >= 0;
  const column = safe ? n % ITEM_ICON_COLUMNS : 0;
  const row = safe ? Math.floor(n / ITEM_ICON_COLUMNS) : 0;
  const x = column * ITEM_ICON_CELL;
  const y = row * ITEM_ICON_CELL;
  return {
    backgroundImage: safe ? `url("${base}/sprites/sheets/itemicons-sheet.png")` : "none",
    backgroundPosition: `-${x}px -${y}px`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${ITEM_SHEET_WIDTH}px ${ITEM_SHEET_HEIGHT}px`,
    width: `${ITEM_ICON_CELL}px`,
    height: `${ITEM_ICON_CELL}px`,
  };
}

export function itemSpriteStyle(spriteNum: number): ItemSpriteStyle;
export function itemSpriteStyle(index: RuntimeIndex, spriteNum: number): ItemSpriteStyle;
export function itemSpriteStyle(indexOrNum: RuntimeIndex | number, spriteNum?: number): ItemSpriteStyle {
  if (typeof indexOrNum === "number") return buildItemStyle(cachedIndex, indexOrNum);
  return buildItemStyle(indexOrNum, spriteNum ?? 0);
}

export const POKEBALL_PLACEHOLDER_URL = `${ASSET_BASE}/fx/pokeball.png`;

function decodeImage(url: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  if (typeof img.decode === "function") return img.decode().then(() => undefined, () => undefined);
  return new Promise((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

/** Decode the first URL of each sprite chain so the active Pokémon does not pop in. */
export function preloadSprites(index: RuntimeIndex, list: readonly SpriteResolveOptions[]): Promise<void> {
  const urls = list.map((item) => resolveSpriteUrls(index, item).urls[0]).filter((url): url is string => Boolean(url));
  return Promise.all(urls.map((url) => decodeImage(url))).then(() => undefined);
}

/** Decode fx images by stem (`impact`) or filename. Unknown names are skipped. */
export function preloadFx(index: RuntimeIndex, names: readonly string[]): Promise<void> {
  const urls = names.map((name) => fxUrl(index, name)).filter((url): url is string => Boolean(url));
  return Promise.all(urls.map((url) => decodeImage(url))).then(() => undefined);
}
