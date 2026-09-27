import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { RUNTIME_INDEX_FILE, SPECIES_DIRECTORIES } from "./lib/catalog.ts";
import type { AssetManifest } from "./lib/manifest.ts";

const GENERATED_DIR = path.join(process.cwd(), "public", "assets", "generated");
const MANIFEST_PATH = path.join(GENERATED_DIR, "manifest.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "audit.json");
const IGNORED = new Set(["manifest.json", "audit.json", "sync-state.jsonl", RUNTIME_INDEX_FILE]);

interface CoverageRow {
  variant: string;
  present: number;
  total: number;
  basePresent: number;
  baseTotal: number;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as AssetManifest;
  const species = Object.entries(manifest.species);
  const baseSpecies = species.filter(([, record]) => record.forme === "");
  const variants = SPECIES_DIRECTORIES.map((directory) => directory.variant);
  const coverage: CoverageRow[] = variants.map((variant) => ({
    variant,
    present: species.filter(([, record]) => record.variants[variant]).length,
    total: species.length,
    basePresent: baseSpecies.filter(([, record]) => record.variants[variant]).length,
    baseTotal: baseSpecies.length,
  }));

  const missingPrimary = species
    .filter(([, record]) => record.gen <= 9 && !record.variants["front-animated"] && !record.variants.home)
    .map(([id, record]) => ({ id, name: record.name, num: record.num, forme: record.forme }));

  const diskFiles = await walk(GENERATED_DIR);
  const onDisk = new Set(diskFiles);
  const referenced = new Set(Object.keys(manifest.files));
  const orphans = diskFiles.filter((file) => !referenced.has(file));
  const missingFiles = [...referenced].filter((file) => !onDisk.has(file));

  const hashes = new Map<string, string[]>();
  for (const file of diskFiles) {
    const hash = await hashFile(path.join(GENERATED_DIR, ...file.split("/")));
    const group = hashes.get(hash);
    if (group) group.push(file);
    else hashes.set(hash, [file]);
  }
  const duplicates = [...hashes.values()].filter((group) => group.length > 1);

  let bytes = 0;
  for (const file of Object.values(manifest.files)) bytes += file.bytes;

  const report = {
    generatedAt: new Date().toISOString(),
    engineVersion: manifest.engineVersion,
    fileCount: diskFiles.length,
    manifestFileCount: Object.keys(manifest.files).length,
    bytes,
    species: species.length,
    baseSpecies: baseSpecies.length,
    coverage,
    missingPrimary,
    missingFiles,
    orphans,
    duplicateGroups: duplicates.length,
    duplicates,
    syncFailures: manifest.stats.failures,
    unavailable: manifest.stats.unavailable ?? [],
  };

  await import("node:fs/promises").then(({ writeFile }) => writeFile(AUDIT_PATH, JSON.stringify(report)));

  console.log(`files on disk=${diskFiles.length} manifest=${report.manifestFileCount} bytes=${bytes}`);
  console.log(`species=${species.length} base=${baseSpecies.length} missing primary=${missingPrimary.length}`);
  console.log(`orphans=${orphans.length} missing files=${missingFiles.length} duplicate groups=${duplicates.length} unavailable=${report.unavailable.length}`);
  for (const row of coverage) {
    console.log(
      `${row.variant}: ${row.present}/${row.total} species, ${row.basePresent}/${row.baseTotal} base`,
    );
  }
  if (missingPrimary.length > 0) {
    console.log(`missing primary sample: ${missingPrimary.slice(0, 15).map((entry) => entry.id).join(", ")}`);
  }
  if (manifest.stats.failures.length > 0 || missingFiles.length > 0) process.exitCode = 1;
}

async function walk(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await walk(path.join(directory, entry.name), relative));
      continue;
    }
    if (IGNORED.has(entry.name) || entry.name.endsWith(".partial")) continue;
    files.push(relative);
  }
  return files;
}

function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

await stat(MANIFEST_PATH);
await main();
