export const ENGINE_VERSION = "0.11.11";

export const SHOWDOWN_SPRITES = "https://play.pokemonshowdown.com/sprites/";
export const SHOWDOWN_FX = "https://play.pokemonshowdown.com/fx/";
export const POKEAPI_SPRITES =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
export const POKEAPI_CSV =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";

export const USER_AGENT = "PokeShowdownAssetSync/1.0";

export const SPECIES_DIRECTORIES = [
  { folder: "ani", variant: "front-animated" },
  { folder: "ani-back", variant: "back-animated" },
  { folder: "ani-shiny", variant: "front-animated-shiny" },
  { folder: "ani-back-shiny", variant: "back-animated-shiny" },
  { folder: "gen1", variant: "gen1-front" },
  { folder: "gen1-back", variant: "gen1-back" },
  { folder: "gen2", variant: "gen2-front" },
  { folder: "gen2-back", variant: "gen2-back" },
  { folder: "gen2-shiny", variant: "gen2-front-shiny" },
  { folder: "gen2-back-shiny", variant: "gen2-back-shiny" },
  { folder: "gen3", variant: "gen3-front" },
  { folder: "gen3-back", variant: "gen3-back" },
  { folder: "gen3-shiny", variant: "gen3-front-shiny" },
  { folder: "gen3-back-shiny", variant: "gen3-back-shiny" },
  { folder: "gen4", variant: "gen4-front" },
  { folder: "gen4-back", variant: "gen4-back" },
  { folder: "gen4-shiny", variant: "gen4-front-shiny" },
  { folder: "gen4-back-shiny", variant: "gen4-back-shiny" },
  { folder: "gen5", variant: "gen5-front" },
  { folder: "gen5-back", variant: "gen5-back" },
  { folder: "gen5-shiny", variant: "gen5-front-shiny" },
  { folder: "gen5-back-shiny", variant: "gen5-back-shiny" },
  { folder: "gen6", variant: "gen6-front" },
  { folder: "gen6-back", variant: "gen6-back" },
  { folder: "home", variant: "home" },
  { folder: "home-centered", variant: "home-centered" },
  { folder: "home-shiny", variant: "home-shiny" },
  { folder: "home-centered-shiny", variant: "home-centered-shiny" },
] as const;

export const SHARED_DIRECTORIES = [
  { folder: "itemicons", group: "items" },
  { folder: "types", group: "types" },
  { folder: "typeicons", group: "typeIcons" },
  { folder: "trainers", group: "trainers" },
  { folder: "substitutes", group: "substitutes", recursive: true },
  { folder: "gen6bgs", group: "backgrounds", preferJpg: true },
] as const;

export const ICON_SHEETS = [
  "pokemonicons-sheet.png",
  "pokemonicons-pokeball-sheet.png",
  "itemicons-sheet.png",
] as const;

/** Species folders included in the Vercel runtime profile. Shiny ani stays local-only. */
export const RUNTIME_SPECIES_FOLDERS = new Set([
  "ani",
  "ani-back",
  "gen5",
  "gen5-back",
  "gen5-shiny",
  "gen5-back-shiny",
]);

/**
 * Bit order for runtime-index.json. ani-shiny bits are set only when those
 * files are present (full local sync); the runtime profile does not download them.
 */
export const RUNTIME_INDEX_BITS = [
  "ani",
  "ani-back",
  "gen5",
  "gen5-back",
  "gen5-shiny",
  "gen5-back-shiny",
  "ani-shiny",
  "ani-back-shiny",
] as const;

export type RuntimeSpriteBit = (typeof RUNTIME_INDEX_BITS)[number];

export const RUNTIME_INDEX_FILE = "runtime-index.json";

export const RUNTIME_SHARED_FOLDERS = new Set(["types", "typeicons", "gen6bgs", "substitutes"]);

export const RUNTIME_SUBSTITUTE_FOLDERS = new Set(["gen5", "gen5-back"]);

export const RUNTIME_ICON_SHEETS = ["itemicons-sheet.png"] as const;

export const FX_RUNTIME_SKIP_PREFIXES = ["bg-"];

export const ASSET_EXTENSIONS = new Set([
  "gif",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "webm",
  "mp4",
]);

export const PRIMARY_VARIANTS = ["front-animated", "home"] as const;

export const FX_SKIP_PREFIXES = ["client-", "hangman", "mafia-"];
export const FX_SKIP_NAMES = new Set([
  "closebuttonsheet.png",
  "groupchat.png",
  "mail.png",
  "mute.png",
  "pointer.png",
]);
