import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Dex, toID } from "../src/server/showdown/module.ts";
import {
  ASSET_EXTENSIONS,
  ENGINE_VERSION,
  FX_SKIP_NAMES,
  FX_SKIP_PREFIXES,
  ICON_SHEETS,
  POKEAPI_SPRITES,
  SHARED_DIRECTORIES,
  SHOWDOWN_FX,
  SHOWDOWN_SPRITES,
  SPECIES_DIRECTORIES,
} from "./lib/catalog.ts";
import {
  emptyShared,
  type AssetManifest,
  type AssetSource,
  type SharedAsset,
  type SyncFailure,
} from "./lib/manifest.ts";
import {
  EmptyAssetError,
  HttpStatusError,
  downloadToFile,
  extensionOf,
  fetchText,
  mapPool,
  parseDirectoryListing,
  stemOf,
  type RemoteEntry,
} from "./lib/remote.ts";

const require = createRequire(import.meta.url);
const installedVersion = (require("pokemon-showdown/package.json") as { version: string }).version;

const GENERATED_DIR = path.join(process.cwd(), "public", "assets", "generated");
const STATE_PATH = path.join(GENERATED_DIR, "sync-state.jsonl");
const MANIFEST_PATH = path.join(GENERATED_DIR, "manifest.json");
const PUBLIC_PREFIX = "/assets/generated";
const CONCURRENCY = 12;

interface StateEntry {
  relative: string;
  bytes: number;
  remoteMtime: string;
  source: AssetSource;
}

interface PlannedFile {
  relative: string;
  url: string;
  mtime: string;
  source: AssetSource;
  kind: "species" | "shared";
  variant?: string;
  group?: keyof AssetManifest["shared"];
  stem: string;
}

function safeSegment(segment: string) {
  const cleaned = segment.replace(/[<>:"|?*]/g, "");
  if (!cleaned || cleaned.startsWith(".")) return `unknown${cleaned}`;
  return cleaned;
}

function safeRelative(relative: string) {
  return relative.split("/").map((segment) => safeSegment(segment)).join("/");
}

function localRelative(relative: string, casePaths: Map<string, string>) {
  const safe = safeRelative(relative);
  const key = safe.toLowerCase();
  const existing = casePaths.get(key);
  if (!existing) {
    casePaths.set(key, safe);
    return safe;
  }
  if (existing === safe) return safe;
  const dot = safe.lastIndexOf(".");
  const alt = dot === -1 ? `${safe}__alt` : `${safe.slice(0, dot)}__alt${safe.slice(dot)}`;
  casePaths.set(alt.toLowerCase(), alt);
  return alt;
}

function publicPath(relative: string) {
  return `${PUBLIC_PREFIX}/${relative}`;
}

function diskPath(relative: string) {
  return path.join(GENERATED_DIR, ...relative.split("/"));
}

function loadState(): Map<string, StateEntry> {
  const state = new Map<string, StateEntry>();
  if (!existsSync(STATE_PATH)) return state;
  for (const line of readFileSync(STATE_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as StateEntry;
    state.set(entry.relative, entry);
  }
  return state;
}

function remember(state: Map<string, StateEntry>, entry: StateEntry, append: boolean) {
  state.set(entry.relative, entry);
  if (append) appendFileSync(STATE_PATH, `${JSON.stringify(entry)}\n`);
}

function isAssetFile(name: string) {
  return ASSET_EXTENSIONS.has(extensionOf(name));
}

function keepFx(name: string, names: Set<string>) {
  if (!isAssetFile(name)) return false;
  if (FX_SKIP_PREFIXES.some((prefix) => name.startsWith(prefix))) return false;
  if (FX_SKIP_NAMES.has(name)) return false;
  if (name.endsWith(".mp4") && names.has(name.slice(0, -4) + ".webm")) return false;
  return true;
}

function preferJpg<T extends RemoteEntry>(entries: T[]) {
  const jpgStems = new Set(
    entries.filter((entry) => entry.name.endsWith(".jpg")).map((entry) => stemOf(entry.name)),
  );
  return entries.filter((entry) => {
    if (!entry.name.endsWith(".png")) return true;
    return !jpgStems.has(stemOf(entry.name));
  });
}

async function listFiles(url: string, recursive: boolean): Promise<Array<RemoteEntry & { urlPath: string }>> {
  const directoryUrl = url.endsWith("/") ? url : `${url}/`;
  const html = await fetchText(`${directoryUrl}?view=dir`);
  const entries = parseDirectoryListing(html);
  const files: Array<RemoteEntry & { urlPath: string }> = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      if (!recursive) continue;
      const nested = await listFiles(`${url}${entry.name}/`, true);
      for (const file of nested) {
        files.push({ ...file, urlPath: `${entry.name}/${file.urlPath}` });
      }
      continue;
    }
    if (!isAssetFile(entry.name)) continue;
    files.push({ ...entry, urlPath: entry.name });
  }
  return files;
}

function uniqueId(stem: string, used: Set<string>) {
  const base = toID(stem) || stem;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

async function main() {
  if (installedVersion !== ENGINE_VERSION) {
    throw new Error(`pokemon-showdown ${installedVersion} does not match ${ENGINE_VERSION}`);
  }

  await mkdir(GENERATED_DIR, { recursive: true });
  const state = loadState();
  const failures: SyncFailure[] = [];
  const casePaths = new Map<string, string>();
  const planned: PlannedFile[] = [];

  const rootListing = parseDirectoryListing(await fetchText(SHOWDOWN_SPRITES));
  const rootByName = new Map(rootListing.map((entry) => [entry.name, entry]));
  for (const sheet of ICON_SHEETS) {
    const remote = rootByName.get(sheet);
    if (!remote || remote.isDirectory) {
      throw new Error(`missing icon sheet ${sheet} in ${SHOWDOWN_SPRITES}`);
    }
    planned.push({
      relative: localRelative(`sprites/sheets/${sheet}`, casePaths),
      url: `${SHOWDOWN_SPRITES}${sheet}`,
      mtime: remote.mtime,
      source: "showdown",
      kind: "shared",
      group: "iconSheets",
      stem: stemOf(sheet),
    });
  }

  for (const directory of SPECIES_DIRECTORIES) {
    const files = await listFiles(`${SHOWDOWN_SPRITES}${directory.folder}/`, false);
    if (directory.folder === "ani" && files.length < 1000) {
      throw new Error(`ani listing parsed ${files.length} files`);
    }
    console.log(`listed ${directory.folder}: ${files.length}`);
    for (const file of files) {
      planned.push({
        relative: localRelative(`sprites/${directory.folder}/${file.urlPath}`, casePaths),
        url: `${SHOWDOWN_SPRITES}${directory.folder}/${file.urlPath}`,
        mtime: file.mtime,
        source: "showdown",
        kind: "species",
        variant: directory.variant,
        stem: stemOf(file.name),
      });
    }
  }

  for (const directory of SHARED_DIRECTORIES) {
    let files = await listFiles(`${SHOWDOWN_SPRITES}${directory.folder}/`, "recursive" in directory);
    if ("preferJpg" in directory) files = preferJpg(files);
    console.log(`listed ${directory.folder}: ${files.length}`);
    for (const file of files) {
      planned.push({
        relative: localRelative(`sprites/${directory.folder}/${file.urlPath}`, casePaths),
        url: `${SHOWDOWN_SPRITES}${directory.folder}/${file.urlPath}`,
        mtime: file.mtime,
        source: "showdown",
        kind: "shared",
        group: directory.group,
        stem: stemOf(file.urlPath.replaceAll("/", "-")),
      });
    }
  }

  const fxFiles = await listFiles(SHOWDOWN_FX, false);
  const fxNames = new Set(fxFiles.map((file) => file.name));
  const keptFx = fxFiles.filter((file) => keepFx(file.name, fxNames));
  console.log(`listed fx: ${keptFx.length}`);
  for (const file of keptFx) {
    planned.push({
      relative: localRelative(`fx/${file.urlPath}`, casePaths),
      url: `${SHOWDOWN_FX}${file.urlPath}`,
      mtime: file.mtime,
      source: "showdown",
      kind: "shared",
      group: "effects",
      stem: stemOf(file.name),
    });
  }

  let downloaded = 0;
  let skipped = 0;
  let finished = 0;
  const unavailable: SyncFailure[] = [];

  await mapPool(planned, CONCURRENCY, async (file) => {
    const previous = state.get(file.relative);
    const destination = diskPath(file.relative);
    if (previous && previous.remoteMtime === file.mtime && previous.bytes > 0) {
      try {
        const local = await stat(destination);
        if (local.size === previous.bytes) {
          skipped += 1;
          finished += 1;
          if (finished % 500 === 0) logProgress(finished, planned.length, downloaded, skipped, failures.length);
          return;
        }
      } catch {
        // The local copy is missing or unreadable, so download it again.
      }
    }
    try {
      const bytes = await downloadToFile(file.url, destination);
      remember(state, {
        relative: file.relative,
        bytes,
        remoteMtime: file.mtime,
        source: file.source,
      }, true);
      downloaded += 1;
    } catch (error) {
      if (error instanceof EmptyAssetError) unavailable.push({ url: file.url, message: error.message });
      else failures.push({ url: file.url, message: errorMessage(error) });
    }
    finished += 1;
    if (finished % 500 === 0 || finished === planned.length) {
      logProgress(finished, planned.length, downloaded, skipped, failures.length);
    }
  });

  const spriteIndex = new Map<string, string>();
  for (const species of Dex.species.all()) {
    if (!species.exists || species.num <= 0) continue;
    spriteIndex.set(species.spriteid, species.id);
    spriteIndex.set(species.id, species.id);
  }

  const speciesRecords: AssetManifest["species"] = {};
  for (const species of Dex.species.all()) {
    if (!species.exists || species.num <= 0) continue;
    speciesRecords[species.id] = {
      num: species.num,
      name: species.name,
      spriteId: species.spriteid,
      forme: species.forme,
      gen: species.gen,
      variants: {},
    };
  }

  const shared = emptyShared();
  const usedIds = new Map<keyof AssetManifest["shared"], Set<string>>();
  for (const group of Object.keys(shared) as Array<keyof AssetManifest["shared"]>) {
    usedIds.set(group, new Set());
  }

  const files: AssetManifest["files"] = {};
  for (const file of planned) {
    const saved = state.get(file.relative);
    if (!saved) continue;
    files[file.relative] = {
      bytes: saved.bytes,
      remoteMtime: saved.remoteMtime,
      source: saved.source,
    };
    const asset = {
      path: publicPath(file.relative),
      source: saved.source,
      available: true as const,
      bytes: saved.bytes,
      remoteMtime: saved.remoteMtime,
    };
    if (file.kind === "species" && file.variant) {
      const speciesId = spriteIndex.get(file.stem) ?? spriteIndex.get(toID(file.stem));
      if (!speciesId) continue;
      speciesRecords[speciesId].variants[file.variant] = asset;
      continue;
    }
    if (file.group) {
      const id = uniqueId(file.stem, usedIds.get(file.group)!);
      const sharedAsset: SharedAsset = { id, ...asset };
      shared[file.group][id] = sharedAsset;
    }
  }

  const fallbacks = planPokeapiFallbacks(speciesRecords);
  console.log(`pokeapi fallbacks: ${fallbacks.length}`);
  await mapPool(fallbacks, CONCURRENCY, async (file) => {
    const destination = diskPath(file.relative);
    const previous = state.get(file.relative);
    let bytes = previous?.bytes ?? 0;
    if (previous && previous.bytes > 0) {
      try {
        const local = await stat(destination);
        if (local.size === previous.bytes) {
          skipped += 1;
          bytes = previous.bytes;
        } else {
          bytes = 0;
        }
      } catch {
        bytes = 0;
      }
    }
    if (bytes === 0) {
      try {
        bytes = await downloadToFile(file.url, destination);
        remember(state, {
          relative: file.relative,
          bytes,
          remoteMtime: file.mtime,
          source: "pokeapi",
        }, true);
        downloaded += 1;
      } catch (error) {
        if (error instanceof HttpStatusError && error.status === 404) return;
        failures.push({ url: file.url, message: errorMessage(error) });
        return;
      }
    }
    const species = speciesRecords[file.stem];
    if (species && file.variant) {
      species.variants[file.variant] = {
        path: publicPath(file.relative),
        source: "pokeapi",
        available: true,
        bytes,
        remoteMtime: file.mtime,
      };
    }
    files[file.relative] = { bytes, remoteMtime: file.mtime, source: "pokeapi" };
  });

  let bytes = 0;
  for (const file of Object.values(files)) bytes += file.bytes;
  const manifest: AssetManifest = {
    engineVersion: installedVersion,
    generatedAt: new Date().toISOString(),
    sources: {
      showdownSprites: SHOWDOWN_SPRITES,
      showdownFx: SHOWDOWN_FX,
      pokeapiSprites: POKEAPI_SPRITES,
    },
    stats: {
      fileCount: Object.keys(files).length,
      bytes,
      downloaded,
      skipped,
      failures,
      unavailable,
    },
    species: speciesRecords,
    shared,
    files,
  };

  const { writeFile } = await import("node:fs/promises");
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest));
  console.log(
    `manifest files=${manifest.stats.fileCount} bytes=${manifest.stats.bytes} downloaded=${downloaded} skipped=${skipped} failures=${failures.length} unavailable=${unavailable.length}`,
  );
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 20)) console.error(`${failure.message}`);
    process.exitCode = 1;
  }
}

function planPokeapiFallbacks(speciesRecords: AssetManifest["species"]): PlannedFile[] {
  const planned: PlannedFile[] = [];
  for (const [speciesId, species] of Object.entries(speciesRecords)) {
    if (species.forme) continue;
    if (!species.variants["front-animated"]) {
      planned.push({
        relative: `pokeapi/showdown/${species.num}.gif`,
        url: `${POKEAPI_SPRITES}pokemon/other/showdown/${species.num}.gif`,
        mtime: "pokeapi",
        source: "pokeapi",
        kind: "species",
        variant: "front-animated",
        stem: speciesId,
      });
    }
    if (!species.variants.home) {
      planned.push({
        relative: `pokeapi/official-artwork/${species.num}.png`,
        url: `${POKEAPI_SPRITES}pokemon/other/official-artwork/${species.num}.png`,
        mtime: "pokeapi",
        source: "pokeapi",
        kind: "species",
        variant: "home",
        stem: speciesId,
      });
    }
  }
  return planned;
}

function logProgress(finished: number, total: number, downloaded: number, skipped: number, failed: number) {
  console.log(`progress ${finished}/${total} downloaded=${downloaded} skipped=${skipped} failed=${failed}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

await main();
