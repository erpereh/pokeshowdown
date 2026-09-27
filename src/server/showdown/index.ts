import "server-only";
import { createRequire } from "node:module";
import { BattleStream, Dex, TeamValidator, Teams } from "./module.ts";

const require = createRequire(import.meta.url);
const { version } = require("pokemon-showdown/package.json") as { version: string };

export const ENGINE_VERSION = version;

export function getDex() {
  return Dex;
}

export function getTeams() {
  return Teams;
}

export function createTeamValidator(formatId: string) {
  return new TeamValidator(formatId);
}

export function createBattleStream() {
  return new BattleStream();
}

export function getEngineVersion() {
  return ENGINE_VERSION;
}
