import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toID } from "../showdown/module.ts";

export interface SpanishEntry {
  num: number;
  name: string;
  genus?: string;
  formName?: string;
}

interface ComplementFile {
  language: "es";
  entries: Record<string, SpanishEntry>;
}

let cache: ComplementFile | null | undefined;

function loadComplement(): ComplementFile | null {
  if (cache !== undefined) return cache;
  const filePath = path.join(process.cwd(), "data", "complement", "es.json");
  try {
    cache = JSON.parse(readFileSync(filePath, "utf8")) as ComplementFile;
  } catch {
    cache = null;
  }
  return cache;
}

export function getSpanishEntry(showdownId: string): SpanishEntry | null {
  const file = loadComplement();
  if (!file) return null;
  return file.entries[toID(showdownId)] ?? null;
}
