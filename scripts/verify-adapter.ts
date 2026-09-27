import { createBattleStream, createTeamValidator, getDex, getEngineVersion, getTeams } from "../src/server/showdown/index.ts";
import { getSpanishEntry } from "../src/server/pokemon-data/index.ts";
import { ENGINE_VERSION } from "./lib/catalog.ts";

if (getEngineVersion() !== ENGINE_VERSION) {
  throw new Error(`adapter version ${getEngineVersion()} does not match ${ENGINE_VERSION}`);
}

const dex = getDex();
if (!dex.species.get("dragapult").exists) throw new Error("adapter Dex failed");
if (typeof getTeams().pack !== "function") throw new Error("adapter Teams failed");
if (createTeamValidator("gen9ou").format.id !== "gen9ou") throw new Error("adapter TeamValidator failed");
createBattleStream();

const typeNull = getSpanishEntry("Type: Null");
if (!typeNull?.name.includes("Cero")) throw new Error("adapter complement lookup failed");

console.log("server adapter verified");
