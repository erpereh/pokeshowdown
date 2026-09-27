import "server-only";
import showdownPackage from "pokemon-showdown/package.json" with { type: "json" };
import { BattleStream, Dex, TeamValidator, Teams } from "./module.ts";

export const ENGINE_VERSION = showdownPackage.version;

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
