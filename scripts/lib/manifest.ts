export type AssetSource = "showdown" | "pokeapi";

export interface AssetFile {
  path: string;
  source: AssetSource;
  available: true;
  bytes: number;
  remoteMtime: string;
}

export interface SpeciesRecord {
  num: number;
  name: string;
  spriteId: string;
  forme: string;
  gen: number;
  variants: Record<string, AssetFile>;
}

export interface SharedAsset extends AssetFile {
  id: string;
}

export interface SyncFailure {
  url: string;
  message: string;
}

export interface AssetManifest {
  engineVersion: string;
  generatedAt: string;
  sources: {
    showdownSprites: string;
    showdownFx: string;
    pokeapiSprites: string;
  };
  stats: {
    fileCount: number;
    bytes: number;
    downloaded: number;
    skipped: number;
    failures: SyncFailure[];
    unavailable: SyncFailure[];
  };
  species: Record<string, SpeciesRecord>;
  shared: {
    iconSheets: Record<string, SharedAsset>;
    items: Record<string, SharedAsset>;
    types: Record<string, SharedAsset>;
    typeIcons: Record<string, SharedAsset>;
    trainers: Record<string, SharedAsset>;
    substitutes: Record<string, SharedAsset>;
    backgrounds: Record<string, SharedAsset>;
    effects: Record<string, SharedAsset>;
  };
  files: Record<string, { bytes: number; remoteMtime: string; source: AssetSource }>;
}

export interface RuntimeSpriteIndex {
  v: 1;
  engine: string;
  base: string;
  bits: readonly string[];
  /** id → [bitmask, frontW, frontH, backW, backH] */
  sprites: Record<string, [number, number, number, number, number]>;
  /** Filenames in sprites/gen6bgs/, sprites/types/, and fx/. */
  backgrounds: string[];
  fx: string[];
  types: string[];
}

export function emptyShared(): AssetManifest["shared"] {
  return {
    iconSheets: {},
    items: {},
    types: {},
    typeIcons: {},
    trainers: {},
    substitutes: {},
    backgrounds: {},
    effects: {},
  };
}
