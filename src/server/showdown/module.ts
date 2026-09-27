import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const showdown = require("pokemon-showdown") as typeof import("pokemon-showdown");

export const Dex = showdown.Dex;
export const toID = showdown.toID;
export const Teams = showdown.Teams;
export const TeamValidator = showdown.TeamValidator;
export const BattleStream = showdown.BattleStream;
