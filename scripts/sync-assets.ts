import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { copyFile, link, mkdir, open, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Dex, toID } from "../src/server/showdown/module.ts";
import {
  ASSET_EXTENSIONS,
  ENGINE_VERSION,
  FX_RUNTIME_SKIP_PREFIXES,
  FX_SKIP_NAMES,
  FX_SKIP_PREFIXES,
  ICON_SHEETS,
  POKEAPI_SPRITES,
  RUNTIME_ICON_SHEETS,
  RUNTIME_INDEX_BITS,
  RUNTIME_INDEX_FILE,
  RUNTIME_SHARED_FOLDERS,
  RUNTIME_SPECIES_FOLDERS,
  RUNTIME_SUBSTITUTE_FOLDERS,
  SHARED_DIRECTORIES,
  SHOWDOWN_FX,
  SHOWDOWN_SPRITES,
  SPECIES_DIRECTORIES,
  type RuntimeSpriteBit,
} from "./lib/catalog.ts";
import {
  emptyShared,
  type AssetManifest,
  type AssetSource,
  type RuntimeSpriteIndex,
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

const PUBLIC_DIR = path.join(process.cwd(), "public", "assets", "generated");
const VERCEL_MIRROR = path.join(process.cwd(), ".next", "cache", "showdown-assets");
const PUBLIC_PREFIX = "/assets/generated";
const CONCURRENCY = 12;

type Profile = "full" | "runtime";

let mirrorDir = PUBLIC_DIR;
let publishDir = PUBLIC_DIR;

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

interface CliOptions {
  profile: Profile;
  out?: string;
  mirror?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { profile: "full" };
  for (const arg of argv) {
    if (arg === "--profile=full" || arg === "--profile=runtime") {
      options.profile = arg.slice("--profile=".length) as Profile;
      continue;
    }
    if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
      continue;
    }
    if (arg.startsWith("--mirror=")) {
      options.mirror = arg.slice("--mirror=".length);
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function resolveCliDir(value: string) {
  return path.resolve(process.cwd(), value);
}

function statePath() {
  return path.join(mirrorDir, "sync-state.jsonl");
}

function manifestPath() {
  return path.join(mirrorDir, "manifest.json");
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
  return path.join(mirrorDir, ...relative.split("/"));
}

function loadState(): Map<string, StateEntry> {
  const state = new Map<string, StateEntry>();
  const filePath = statePath();
  if (!existsSync(filePath)) return state;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as StateEntry;
    state.set(entry.relative, entry);
  }
  return state;
}

function remember(state: Map<string, StateEntry>, entry: StateEntry, append: boolean) {
  state.set(entry.relative, entry);
  if (append) appendFileSync(statePath(), `${JSON.stringify(entry)}\n`);
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

function keepRuntimeFx(name: string, names: Set<string>) {
  if (!keepFx(name, names)) return false;
  if (FX_RUNTIME_SKIP_PREFIXES.some((prefix) => name.startsWith(prefix))) return false;
  if (extensionOf(name) === "webm") return false;
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

function spriteIdOf(species: { baseSpecies: string; forme: string }) {
  const base = toID(species.baseSpecies);
  return species.forme ? `${base}-${toID(species.forme)}` : base;
}

function cosmeticSpriteId(baseSpecies: string, cosmetic: string) {
  const prefix = `${baseSpecies}-`;
  const formeName = cosmetic.startsWith(prefix) ? cosmetic.slice(prefix.length) : cosmetic;
  return `${toID(baseSpecies)}-${toID(formeName)}`;
}

/**
 * Gen 9 usable sprite filenames: standard species (num > 0, not nonstandard,
 * which already includes gen 9 battle-only formes), cosmetic forme ids
 * (`toID(base)-toID(forme)`), and `-f` female variants. Past megas are
 * nonstandard in gen 9 and stay out. The non-`-f` set is 927 ids.
 */
function gen9RuntimeSpriteIds() {
  const dex = Dex.forGen(9);
  const ids = new Set<string>();
  const add = (id: string) => {
    ids.add(id);
    ids.add(`${id}-f`);
  };
  for (const species of dex.species.all()) {
    if (!species.exists || species.num <= 0 || species.isNonstandard) continue;
    add(spriteIdOf(species));
    for (const cosmetic of species.cosmeticFormes ?? []) {
      add(cosmeticSpriteId(species.baseSpecies, cosmetic));
    }
  }
  return ids;
}

async function imageSize(filePath: string): Promise<[number, number]> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(24);
    const { bytesRead } = await handle.read(buffer, 0, 24, 0);
    if (bytesRead < 10) return [0, 0];
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return [buffer.readUInt16LE(6), buffer.readUInt16LE(8)];
    }
    if (bytesRead >= 24 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
      return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
    }
    return [0, 0];
  } finally {
    await handle.close();
  }
}

async function listAssetNames(directory: string) {
  if (!existsSync(directory)) return [];
  const names = await readdir(directory);
  return names.filter((name) => isAssetFile(name)).sort((left, right) => left.localeCompare(right));
}

async function writeRuntimeIndex(engine: string) {
  const sprites = new Map<string, { mask: number; paths: Partial<Record<RuntimeSpriteBit, string>> }>();
  for (let bitIndex = 0; bitIndex < RUNTIME_INDEX_BITS.length; bitIndex += 1) {
    const bit = RUNTIME_INDEX_BITS[bitIndex];
    const directory = path.join(publishDir, "sprites", bit);
    if (!existsSync(directory)) continue;
    for (const name of await readdir(directory)) {
      if (!isAssetFile(name)) continue;
      const id = stemOf(name);
      const draft = sprites.get(id) ?? { mask: 0, paths: {} };
      draft.mask |= 1 << bitIndex;
      draft.paths[bit] = path.join(directory, name);
      sprites.set(id, draft);
    }
  }

  const spriteIndex: RuntimeSpriteIndex["sprites"] = {};
  const entries = [...sprites.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  await mapPool(entries, CONCURRENCY, async ([id, draft]) => {
    const frontPath = draft.paths.ani ?? draft.paths.gen5;
    const backPath = draft.paths["ani-back"] ?? draft.paths["gen5-back"];
    const [frontW, frontH] = frontPath ? await imageSize(frontPath) : [0, 0];
    const [backW, backH] = backPath ? await imageSize(backPath) : [0, 0];
    spriteIndex[id] = [draft.mask, frontW, frontH, backW, backH];
  });

  const index: RuntimeSpriteIndex = {
    v: 1,
    engine,
    base: PUBLIC_PREFIX,
    bits: RUNTIME_INDEX_BITS,
    sprites: spriteIndex,
    backgrounds: await listAssetNames(path.join(publishDir, "sprites", "gen6bgs")),
    fx: await listAssetNames(path.join(publishDir, "fx")),
    types: await listAssetNames(path.join(publishDir, "sprites", "types")),
  };
  await mkdir(publishDir, { recursive: true });
  await writeFile(path.join(publishDir, RUNTIME_INDEX_FILE), JSON.stringify(index));
  console.log(
    `runtime-index sprites=${Object.keys(spriteIndex).length} backgrounds=${index.backgrounds.length} fx=${index.fx.length} types=${index.types.length}`,
  );
}

async function publishKeptFiles(relatives: string[], onVercel: boolean) {
  if (path.resolve(mirrorDir) === path.resolve(publishDir)) return;
  await rm(publishDir, { recursive: true, force: true });
  await mkdir(publishDir, { recursive: true });
  let linked = 0;
  let copied = 0;
  for (const relative of relatives) {
    const from = path.join(mirrorDir, ...relative.split("/"));
    const to = path.join(publishDir, ...relative.split("/"));
    await mkdir(path.dirname(to), { recursive: true });
    if (!onVercel) {
      try {
        await link(from, to);
        linked += 1;
        continue;
      } catch {
        // Local filesystems may not support hardlinks; publish a real copy instead.
      }
    }
    await copyFile(from, to);
    copied += 1;
  }
  console.log(`published files=${relatives.length} linked=${linked} copied=${copied}`);
}

async function main() {
  if (installedVersion !== ENGINE_VERSION) {
    throw new Error(`pokemon-showdown ${installedVersion} does not match ${ENGINE_VERSION}`);
  }

  const options = parseArgs(process.argv.slice(2));
  const onVercel = Boolean(process.env.VERCEL);
  mirrorDir = options.mirror
    ? resolveCliDir(options.mirror)
    : onVercel
      ? VERCEL_MIRROR
      : PUBLIC_DIR;
  publishDir = options.out
    ? resolveCliDir(options.out)
    : onVercel
      ? PUBLIC_DIR
      : mirrorDir;
  console.log(`profile=${options.profile} mirror=${mirrorDir} publish=${publishDir}`);

  await mkdir(mirrorDir, { recursive: true });
  const state = loadState();
  const failures: SyncFailure[] = [];
  const casePaths = new Map<string, string>();
  const planned: PlannedFile[] = [];
  const spriteIds = options.profile === "runtime" ? gen9RuntimeSpriteIds() : null;
  if (spriteIds) console.log(`runtime sprite ids=${spriteIds.size}`);

  const rootListing = parseDirectoryListing(await fetchText(SHOWDOWN_SPRITES));
  const rootByName = new Map(rootListing.map((entry) => [entry.name, entry]));
  const iconSheets = options.profile === "runtime" ? RUNTIME_ICON_SHEETS : ICON_SHEETS;
  for (const sheet of iconSheets) {
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

  const speciesDirectories = options.profile === "runtime"
    ? SPECIES_DIRECTORIES.filter((directory) => RUNTIME_SPECIES_FOLDERS.has(directory.folder))
    : SPECIES_DIRECTORIES;
  for (const directory of speciesDirectories) {
    const files = await listFiles(`${SHOWDOWN_SPRITES}${directory.folder}/`, false);
    if (directory.folder === "ani" && files.length < 1000) {
      throw new Error(`ani listing parsed ${files.length} files`);
    }
    let kept = 0;
    for (const file of files) {
      const stem = stemOf(file.name);
      if (spriteIds && !spriteIds.has(stem)) continue;
      kept += 1;
      planned.push({
        relative: localRelative(`sprites/${directory.folder}/${file.urlPath}`, casePaths),
        url: `${SHOWDOWN_SPRITES}${directory.folder}/${file.urlPath}`,
        mtime: file.mtime,
        source: "showdown",
        kind: "species",
        variant: directory.variant,
        stem,
      });
    }
    console.log(`listed ${directory.folder}: ${files.length}${spriteIds ? ` kept ${kept}` : ""}`);
  }

  const sharedDirectories = options.profile === "runtime"
    ? SHARED_DIRECTORIES.filter((directory) => RUNTIME_SHARED_FOLDERS.has(directory.folder))
    : SHARED_DIRECTORIES;
  for (const directory of sharedDirectories) {
    let files = await listFiles(`${SHOWDOWN_SPRITES}${directory.folder}/`, "recursive" in directory);
    if ("preferJpg" in directory) files = preferJpg(files);
    let kept = 0;
    for (const file of files) {
      if (options.profile === "runtime" && directory.folder === "substitutes") {
        const folder = file.urlPath.split("/")[0];
        if (!RUNTIME_SUBSTITUTE_FOLDERS.has(folder)) continue;
      }
      kept += 1;
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
    console.log(`listed ${directory.folder}: ${files.length}${options.profile === "runtime" ? ` kept ${kept}` : ""}`);
  }

  const fxFiles = await listFiles(SHOWDOWN_FX, false);
  const fxNames = new Set(fxFiles.map((file) => file.name));
  const keptFx = fxFiles.filter((file) =>
    options.profile === "runtime" ? keepRuntimeFx(file.name, fxNames) : keepFx(file.name, fxNames),
  );
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
      const species = speciesRecords[speciesId];
      if (!species) continue;
      species.variants[file.variant] = asset;
      continue;
    }
    if (file.group) {
      const id = uniqueId(file.stem, usedIds.get(file.group)!);
      const sharedAsset: SharedAsset = { id, ...asset };
      shared[file.group][id] = sharedAsset;
    }
  }

  const fallbacks = options.profile === "full" ? planPokeapiFallbacks(speciesRecords) : [];
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

  await writeFile(manifestPath(), JSON.stringify(manifest));
  await publishKeptFiles(Object.keys(files), onVercel);
  await writeRuntimeIndex(installedVersion);
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
