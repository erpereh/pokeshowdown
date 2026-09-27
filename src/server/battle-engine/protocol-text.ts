import "server-only";
import type { PokemonRef, SideId, StatusId } from "../../shared/contract/index.ts";

const STATUSES = new Set<StatusId>(["brn", "par", "slp", "frz", "psn", "tox"]);

export interface ParsedDetails {
  species: string;
  level: number;
  gender: "M" | "F" | "N";
  shiny: boolean;
}

export interface ParsedCondition {
  hp: number;
  maxHp: number;
  status: StatusId | null;
  fainted: boolean;
  /** True when the protocol included a status token or `fnt`. */
  explicitStatus: boolean;
}

export function isStatusId(value: string): value is StatusId {
  return STATUSES.has(value as StatusId);
}

export function parseDetails(details: string): ParsedDetails {
  const parts = details.split(", ");
  const species = parts[0] ?? "";
  let level = 100;
  let gender: "M" | "F" | "N" = "N";
  let shiny = false;
  for (const part of parts.slice(1)) {
    if (part === "M" || part === "F") gender = part;
    else if (part === "shiny") shiny = true;
    else if (/^L\d+$/.test(part)) level = Number(part.slice(1));
  }
  return { species, level, gender, shiny };
}

export function parseCondition(condition: string): ParsedCondition {
  if (condition === "0 fnt" || condition.endsWith(" fnt")) {
    return { hp: 0, maxHp: 0, status: null, fainted: true, explicitStatus: true };
  }
  const space = condition.indexOf(" ");
  const hpPart = space >= 0 ? condition.slice(0, space) : condition;
  const statusPart = space >= 0 ? condition.slice(space + 1) : "";
  const slash = hpPart.indexOf("/");
  const hp = Number(slash >= 0 ? hpPart.slice(0, slash) : hpPart);
  const maxHp = Number(slash >= 0 ? hpPart.slice(slash + 1) : hpPart);
  const status = isStatusId(statusPart) ? statusPart : null;
  return {
    hp: Number.isFinite(hp) ? hp : 0,
    maxHp: Number.isFinite(maxHp) ? maxHp : 0,
    status,
    fainted: hp === 0,
    explicitStatus: statusPart.length > 0,
  };
}

export function parseSideId(token: string): SideId | null {
  if (token.startsWith("p1")) return "p1";
  if (token.startsWith("p2")) return "p2";
  return null;
}

export function parsePokemonRef(token: string): PokemonRef | null {
  const match = /^(p[12])[a-d]: (.+)$/.exec(token);
  if (!match) return null;
  const side = match[1];
  if (side !== "p1" && side !== "p2") return null;
  return { side, name: match[2] ?? "" };
}

/** Strip `move:` / `item:` / `ability:` prefixes used in protocol effect slots. */
export function effectName(token: string | undefined): string {
  if (!token) return "";
  return token.replace(/^(move|item|ability): /, "").trim();
}

export function protocolFrom(parts: readonly string[]): string | null {
  const raw = parts.find((part) => part.startsWith("[from] "));
  if (!raw) return null;
  const name = effectName(raw.slice("[from] ".length));
  return name || null;
}

export function nameFromIdent(ident: string): string {
  const index = ident.indexOf(": ");
  return index >= 0 ? ident.slice(index + 2) : ident;
}
