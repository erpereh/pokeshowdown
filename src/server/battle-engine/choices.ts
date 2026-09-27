import "server-only";
import type { PlayerChoice } from "../../shared/contract/index.ts";
import { CHOICE_PATTERN } from "../cpu/contract.ts";
import { InvalidChoiceError } from "./contract.ts";

function reject(message = "Elección inválida."): never {
  const error = new InvalidChoiceError(message);
  error.name = "InvalidChoiceError";
  throw error;
}

function isSlot(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

/** Full permutation of the available team slots (one to six Pokémon). */
export function isTeamPermutation(order: readonly number[]): boolean {
  if (order.length < 1 || order.length > 6) return false;
  const seen = new Set<number>();
  for (const slot of order) {
    if (!Number.isInteger(slot) || slot < 1 || slot > order.length || seen.has(slot)) return false;
    seen.add(slot);
  }
  return seen.size === order.length;
}

/**
 * Build a Showdown choice from typed data. Rejects anything that is not a single
 * safe choice token before it can reach BattleStream (`>eval`, newlines, ...).
 */
export function choiceToProtocol(choice: PlayerChoice): string {
  let line: string;
  if (choice.kind === "move") {
    if (!isSlot(choice.slot, 4)) reject();
    if (choice.terastallize !== undefined && typeof choice.terastallize !== "boolean") reject();
    line = choice.terastallize === true ? `move ${choice.slot} terastallize` : `move ${choice.slot}`;
  } else if (choice.kind === "switch") {
    if (!isSlot(choice.slot, 6)) reject();
    line = `switch ${choice.slot}`;
  } else if (choice.kind === "teamPreview") {
    if (!Array.isArray(choice.order) || !isTeamPermutation(choice.order)) reject();
    line = `team ${choice.order.join("")}`;
  } else {
    reject();
  }
  assertChoiceToken(line);
  return line;
}

export function assertChoiceToken(line: string): void {
  if (!CHOICE_PATTERN.test(line)) reject();
  if (line.includes("\n") || line.includes("\r") || line.includes("\0") || line.includes(">") || line.includes("|")) {
    reject();
  }
}

/** Fixed forfeit command. Never interpolated from user text. */
export const FORFEIT_LINE = ">forcelose p1";
