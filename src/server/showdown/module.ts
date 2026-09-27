import showdownDefault, * as showdownNamespace from "pokemon-showdown";
import battleDefault, * as battleNamespace from "pokemon-showdown/dist/sim/battle.js";

// Native Node ESM exposes the CJS object as default; Webpack honors its __esModule marker.
const PS = showdownDefault ?? showdownNamespace;
const battleModule = battleDefault ?? battleNamespace;

export const Dex = PS.Dex;
export const toID = PS.toID;
export const Teams = PS.Teams;
export const TeamValidator = PS.TeamValidator;
export const BattleStream = PS.BattleStream;
export const PRNG = PS.PRNG;
export const extractChannelMessages = battleModule.extractChannelMessages;
