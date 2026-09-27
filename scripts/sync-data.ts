import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Dex, toID } from "../src/server/showdown/module.ts";
import { POKEAPI_CSV } from "./lib/catalog.ts";
import { fetchText } from "./lib/remote.ts";
import type { SpanishEntry } from "../src/server/pokemon-data/index.ts";

const OUTPUT = path.join(process.cwd(), "data", "complement", "es.json");
const SPANISH = "7";

interface ComplementFile {
  language: "es";
  source: string;
  entries: Record<string, SpanishEntry>;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

function rowsByHeader(text: string) {
  const [header, ...records] = parseCsv(text);
  if (!header) throw new Error("empty csv");
  return records.map((record) => {
    const row: Record<string, string> = {};
    header.forEach((column, index) => {
      row[column] = record[index] ?? "";
    });
    return row;
  });
}

async function main() {
  const [speciesCsv, formNamesCsv, formsCsv] = await Promise.all([
    fetchText(`${POKEAPI_CSV}pokemon_species_names.csv`),
    fetchText(`${POKEAPI_CSV}pokemon_form_names.csv`),
    fetchText(`${POKEAPI_CSV}pokemon_forms.csv`),
  ]);

  const speciesByNum = new Map<number, { name: string; genus: string }>();
  for (const row of rowsByHeader(speciesCsv)) {
    if (row.local_language_id !== SPANISH) continue;
    speciesByNum.set(Number(row.pokemon_species_id), {
      name: row.name,
      genus: row.genus,
    });
  }

  const formIdentifierById = new Map<string, string>();
  for (const row of rowsByHeader(formsCsv)) {
    formIdentifierById.set(row.id, row.identifier);
  }

  const formNameByShowdownId = new Map<string, { name: string; formName: string }>();
  for (const row of rowsByHeader(formNamesCsv)) {
    if (row.local_language_id !== SPANISH) continue;
    const identifier = formIdentifierById.get(row.pokemon_form_id);
    if (!identifier) continue;
    const formName = row.form_name.trim();
    formNameByShowdownId.set(toID(identifier), {
      name: row.pokemon_name.trim(),
      formName,
    });
  }

  const entries: Record<string, SpanishEntry> = {};
  for (const species of Dex.species.all()) {
    if (!species.exists || species.num <= 0) continue;
    const base = speciesByNum.get(species.num);
    const form = formNameByShowdownId.get(species.id);
    const name = form?.name || base?.name;
    if (!name) continue;
    const entry: SpanishEntry = {
      num: species.num,
      name,
    };
    if (base?.genus) entry.genus = base.genus;
    if (form?.formName) entry.formName = form.formName;
    entries[species.id] = entry;
  }

  const typeNull = entries[toID("Type: Null")];
  if (!typeNull?.name.includes("Cero")) {
    throw new Error(`unexpected Spanish name for Type: Null: ${typeNull?.name ?? "missing"}`);
  }
  const pikachu = entries.pikachu;
  if (!pikachu?.genus?.toLowerCase().includes("rat")) {
    throw new Error(`unexpected Pikachu genus: ${pikachu?.genus ?? "missing"}`);
  }

  const file: ComplementFile = {
    language: "es",
    source: `${POKEAPI_CSV}pokemon_species_names.csv,pokemon_form_names.csv,pokemon_forms.csv`,
    entries,
  };
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const ordered = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  file.entries = ordered;
  await writeFile(OUTPUT, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`spanish entries=${Object.keys(ordered).length}`);
}

await main();
