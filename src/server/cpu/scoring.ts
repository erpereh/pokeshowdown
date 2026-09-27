import "server-only";
import type { LegalMove } from "./candidates.ts";
import { type CpuContext, type FoeState } from "./context.ts";

export interface ScoredMove {
  slot: number;
  id: string;
  score: number;
  /** Type-chart multiplier after immunities. 0 when the move cannot hit. */
  effectiveness: number;
  stab: number;
  damaging: boolean;
}

const HAZARD_IDS = ["stealthrock", "spikes", "toxicspikes", "stickyweb", "gmaxsteelsurge"] as const;

const HAZARD_MOVES: Record<string, { id: string; max: number; score: number }> = {
  stealthrock: { id: "stealthrock", max: 1, score: 70 },
  spikes: { id: "spikes", max: 3, score: 62 },
  toxicspikes: { id: "toxicspikes", max: 2, score: 58 },
  stickyweb: { id: "stickyweb", max: 1, score: 66 },
};

const RECOVERY = new Set([
  "recover", "roost", "slackoff", "softboiled", "moonlight", "morningsun", "synthesis",
  "shoreup", "strengthsap", "milkdrink", "healorder", "lunarblessing", "wish",
  "junglehealing", "lifedew",
]);

const SETUP = new Set([
  "swordsdance", "nastyplot", "calmmind", "dragondance", "quiverdance", "bulkup", "coil",
  "shiftgear", "shellsmash", "agility", "rockpolish", "tailglow", "geomancy", "honeclaws",
  "workup", "growth", "tidyup", "victorydance", "clangoroussoul", "noretreat", "filletaway",
  "bellydrum", "curse",
]);

const PROTECT = new Set([
  "protect", "detect", "kingsshield", "spikyshield", "banefulbunker", "silktrap",
  "burningbulwark", "obstruct", "silktrap",
]);

const REMOVAL = new Set(["rapidspin", "defog", "mortalspin", "tidyup"]);

const STATUS_MOVES = new Set([
  "thunderwave", "toxic", "willowisp", "spore", "sleeppowder", "stunspore", "glare",
  "yawn", "hypnosis", "darkvoid", "toxicthread", "lovelykiss", "sing", "poisonpowder",
  "nuzzle",
]);

const ABILITY_IMMUNITY: Record<string, string[]> = {
  levitate: ["ground"],
  eartheater: ["ground"],
  flashfire: ["fire"],
  wellbakedbody: ["fire"],
  waterabsorb: ["water"],
  dryskin: ["water"],
  stormdrain: ["water"],
  voltabsorb: ["electric"],
  lightningrod: ["electric"],
  motordrive: ["electric"],
  sapsipper: ["grass"],
};

export function canonicalMoveId(id: string): string {
  const key = id.toLowerCase();
  if (key.startsWith("hiddenpower")) return "hiddenpower";
  if (key.startsWith("return")) return "return";
  if (key.startsWith("frustration")) return "frustration";
  return key;
}

export function stageMultiplier(stage: number): number {
  if (stage >= 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

/** Neutral spread: 31 IVs, 84 EVs, neutral nature. */
export function estimatedStat(base: number, level: number): number {
  const inner = Math.floor((2 * base + 31 + Math.floor(84 / 4)) * level / 100);
  return inner + 5;
}

export function typeMultiplier(dex: CpuContext["dex"], attackType: string, defenderTypes: string[]): number {
  if (defenderTypes.length === 0) return 1;
  if (!dex.getImmunity(attackType, defenderTypes)) return 0;
  return 2 ** dex.getEffectiveness(attackType, defenderTypes);
}

export function bestTypeEffectiveness(dex: CpuContext["dex"], attackTypes: string[], defenderTypes: string[]): number {
  let best = 0;
  for (const attackType of attackTypes) {
    best = Math.max(best, typeMultiplier(dex, attackType, defenderTypes));
  }
  return best;
}

export function foePressure(ctx: CpuContext, defenderTypes: string[]): number {
  if (!ctx.foe) return 0;
  let best = bestTypeEffectiveness(ctx.dex, ctx.foe.attackTypes, defenderTypes);
  for (const name of ctx.foe.moves) {
    const move = ctx.dex.moves.get(name);
    if (!move.exists || move.category === "Status") continue;
    best = Math.max(best, typeMultiplier(ctx.dex, move.type, defenderTypes));
  }
  return best;
}

function activeTera(ctx: CpuContext, asTera: boolean): string | null {
  if (asTera) return ctx.self.teraType;
  return ctx.self.terastallized;
}

export function stabMultiplier(moveType: string, originalTypes: string[], tera: string | null): number {
  if (tera && tera !== "Stellar") {
    if (moveType === tera) return originalTypes.includes(tera) ? 2 : 1.5;
    return 1;
  }
  return originalTypes.includes(moveType) ? 1.5 : 1;
}

function grantsImmunity(abilityId: string, moveType: string, effectiveness: number, category: string): boolean {
  if (category === "Status" && (abilityId === "goodasgold" || abilityId === "purifyingsalt")) return true;
  if (ABILITY_IMMUNITY[abilityId]?.includes(moveType.toLowerCase())) return true;
  if (abilityId === "wonderguard" && category !== "Status" && effectiveness < 2) return true;
  return false;
}

function abilityFactor(foe: FoeState | null, moveType: string, effectiveness: number, category: string, dex: CpuContext["dex"]): number {
  if (!foe || foe.possibleAbilities.length === 0) return 1;
  let immune = 0;
  for (const ability of foe.possibleAbilities) {
    if (grantsImmunity(dex.toID(ability), moveType, effectiveness, category)) immune += 1;
  }
  if (immune === 0) return 1;
  if (immune === foe.possibleAbilities.length) return 0;
  return 0.5;
}

function typeStatusImmune(moveId: string, moveType: string, foeTypes: string[], dex: CpuContext["dex"]): boolean {
  if (!dex.getImmunity(moveType, foeTypes)) return true;
  const types = new Set(foeTypes.map((type) => type.toLowerCase()));
  if (["thunderwave", "glare", "stunspore", "nuzzle"].includes(moveId) && types.has("electric")) return true;
  if (moveId === "thunderwave" && types.has("ground")) return true;
  if (["toxic", "poisonpowder", "toxicthread"].includes(moveId) && (types.has("poison") || types.has("steel"))) return true;
  if (moveId === "willowisp" && types.has("fire")) return true;
  if (["spore", "sleeppowder", "stunspore", "poisonpowder", "cottonspore"].includes(moveId) && types.has("grass")) return true;
  return false;
}

function statusAbilityBlocked(abilityId: string, moveId: string): boolean {
  if (abilityId === "goodasgold" || abilityId === "purifyingsalt") return true;
  if (["thunderwave", "glare", "stunspore", "nuzzle"].includes(moveId) && abilityId === "limber") return true;
  if (["toxic", "poisonpowder", "toxicthread"].includes(moveId) && (abilityId === "immunity" || abilityId === "pastelveil")) return true;
  if (moveId === "willowisp" && (abilityId === "waterveil" || abilityId === "waterbubble" || abilityId === "thermalexchange")) return true;
  if (["spore", "sleeppowder", "hypnosis", "darkvoid", "lovelykiss", "sing", "yawn"].includes(moveId)
    && (abilityId === "insomnia" || abilityId === "vitalspirit" || abilityId === "sweetveil" || abilityId === "comatose")) {
    return true;
  }
  if (["spore", "sleeppowder", "stunspore", "poisonpowder", "cottonspore"].includes(moveId) && abilityId === "overcoat") return true;
  return false;
}

function statusFactor(ctx: CpuContext, moveId: string, moveType: string): number {
  const foe = ctx.foe;
  if (!foe) return 1;
  if (foe.status) return 0;
  if (typeStatusImmune(moveId, moveType, foe.types, ctx.dex)) return 0;
  const abilities = foe.possibleAbilities.map((ability) => ctx.dex.toID(ability));
  if (abilities.length === 0) return 1;
  const blocked = abilities.filter((ability) => statusAbilityBlocked(ability, moveId)).length;
  if (blocked === 0) return 1;
  if (blocked === abilities.length) return 0;
  return 0.5;
}

function hasOwnHazards(ctx: CpuContext): boolean {
  return HAZARD_IDS.some((id) => (ctx.ownHazards[id] ?? 0) > 0);
}

function utilityScore(ctx: CpuContext, moveId: string, moveType: string, heal: boolean): number {
  if (PROTECT.has(moveId)) return 6;
  if (REMOVAL.has(moveId) && hasOwnHazards(ctx)) return 78;
  const hazard = HAZARD_MOVES[moveId];
  if (hazard && (ctx.foeHazards[hazard.id] ?? 0) < hazard.max) return hazard.score;
  const hpPct = ctx.self.maxHp > 0 ? ctx.self.hp / ctx.self.maxHp : 1;
  if ((RECOVERY.has(moveId) || heal) && hpPct < 0.5) return 108;
  if ((RECOVERY.has(moveId) || heal) && hpPct < 0.72) return 42;
  const threatened = foePressure(ctx, ctx.self.types) >= 2;
  if (SETUP.has(moveId) && hpPct > 0.7 && !threatened) return 48;
  if (STATUS_MOVES.has(moveId) || moveId === "toxic" || moveId === "willowisp" || moveId === "thunderwave") {
    return 64 * statusFactor(ctx, moveId, moveType);
  }
  return 1;
}

function movePower(ctx: CpuContext, move: { basePower: number; ohko?: boolean | string; multihit?: number | number[] }): number {
  if (move.ohko) return 90;
  let power = move.basePower > 0 ? move.basePower : 60;
  const item = ctx.dex.toID(ctx.self.item);
  if (Array.isArray(move.multihit)) {
    const min = move.multihit[0] ?? 1;
    const max = move.multihit[1] ?? min;
    const hits = item === "skilllink" || item === "loadeddice" ? max : (min + max) / 2;
    power *= hits;
  } else if (typeof move.multihit === "number") {
    power *= move.multihit;
  }
  return power;
}

export function scoreMove(ctx: CpuContext, move: LegalMove, asTera: boolean): ScoredMove {
  const id = canonicalMoveId(move.id);
  const data = ctx.dex.moves.get(id);
  const jitter = (ctx.prng.next() - 0.5) * 1e-9;
  if (!data.exists) {
    return { slot: move.slot, id, score: jitter, effectiveness: 0, stab: 1, damaging: false };
  }
  const tera = activeTera(ctx, asTera);
  let moveType = data.type;
  if (tera && (id === "terablast" || id === "terastarstorm")) moveType = tera;
  const stab = stabMultiplier(moveType, ctx.self.types, tera);
  const damaging = data.category !== "Status" || Boolean(data.ohko) || data.basePower > 0;
  if (!damaging) {
    const heal = Boolean(data.flags?.heal);
    const score = utilityScore(ctx, id, moveType, heal) + jitter;
    return { slot: move.slot, id, score, effectiveness: 0, stab, damaging: false };
  }
  const foeTypes = ctx.foe?.types ?? ["Normal"];
  const effectiveness = typeMultiplier(ctx.dex, moveType, foeTypes);
  if (effectiveness === 0) {
    return { slot: move.slot, id, score: jitter, effectiveness: 0, stab, damaging: true };
  }
  const abilities = abilityFactor(ctx.foe, moveType, effectiveness, data.category, ctx.dex);
  if (abilities === 0) {
    return { slot: move.slot, id, score: jitter, effectiveness: 0, stab, damaging: true };
  }
  const category = data.category === "Special" ? "spa" : "atk";
  const defenseKey = data.category === "Special" ? "spd" : "def";
  const rawAttack = ctx.self.stats[category] > 0
    ? ctx.self.stats[category]
    : estimatedStat(ctx.self.baseStats[category] || 80, ctx.self.level);
  const attack = Math.max(1, rawAttack * stageMultiplier(ctx.self.boosts[category] ?? 0));
  const foeLevel = ctx.foe?.level ?? ctx.self.level;
  const foeBase = ctx.foe?.baseStats[defenseKey] ?? 80;
  const defense = Math.max(1, estimatedStat(foeBase, foeLevel) * stageMultiplier(ctx.foe?.boosts[defenseKey] ?? 0));
  const accuracy = data.accuracy === true ? 1 : (data.accuracy ?? 100) / 100;
  const hpPct = ctx.foe && ctx.foe.maxHp > 0 ? ctx.foe.hp / ctx.foe.maxHp : 1;
  const priority = (data.priority ?? 0) > 0 && hpPct <= 0.4 ? 1.35 : 1;
  let penalty = 1;
  if (data.selfdestruct) penalty *= 0.45;
  if (data.recoil) penalty *= 0.9;
  if (data.mindBlownRecoil || data.struggleRecoil) penalty *= 0.75;
  const score = movePower(ctx, data) * stab * effectiveness * abilities * accuracy * (attack / defense) * priority * penalty + jitter;
  return { slot: move.slot, id, score, effectiveness, stab, damaging: true };
}
