import { describe, expect, it } from "vitest";
import type { PlayerChoice, PlayerRequest } from "../../../src/shared/contract/battle.ts";
import type { EngineSecrets, EngineStep } from "../../../src/server/battle-engine/contract.ts";
import { InvalidChoiceError } from "../../../src/server/battle-engine/contract.ts";
import {
  applyPlayerAction,
  createEngineBattle,
  readPerspectiveLog,
  rebuildView,
} from "../../../src/server/battle-engine/engine.ts";
import { applyPlayerAction as applyPublic, createEngineBattle as createPublic } from "../../../src/server/battle-engine/index.ts";
import type { CpuInput } from "../../../src/server/cpu/contract.ts";
import { Dex, Teams, toID } from "../../../src/server/showdown/module.ts";

const SEED = "sodium,0123456789abcdef0123456789abcdef";

function scriptedCpu(input: CpuInput): string[] {
  if (input.request.teamPreview) return ["team 123456"];
  if (input.request.forceSwitch?.some(Boolean)) {
    const slot = input.request.side.pokemon.findIndex((pokemon) => !pokemon.condition.includes("fnt") && !pokemon.active);
    return [`switch ${slot >= 0 ? slot + 1 : 2}`, "default"];
  }
  const moves = input.request.active?.[0]?.moves ?? [];
  const index = moves.findIndex((move) => !move.disabled);
  return [`move ${index >= 0 ? index + 1 : 1}`, "default"];
}

function playerChoice(request: PlayerRequest): PlayerChoice {
  if (request.kind === "teamPreview") return { kind: "teamPreview", order: [1, 2, 3, 4, 5, 6] };
  if (request.kind === "switch") {
    const option = request.switches.find((entry) => !entry.disabled);
    if (!option) throw new Error("no switch");
    return { kind: "switch", slot: option.slot };
  }
  const option = request.moves.find((entry) => !entry.disabled);
  if (!option) throw new Error("no move");
  return { kind: "move", slot: option.slot };
}

function append(secrets: EngineSecrets, step: EngineStep): EngineSecrets {
  return { ...secrets, inputLog: [...secrets.inputLog, ...step.inputLogDelta] };
}

function legalOuTeam(): string {
  const names = ["Kingambit", "Great Tusk", "Dragapult", "Gholdengo", "Iron Valiant", "Ting-Lu", "Corviknight", "Toxapex"];
  const team = [];
  for (const name of names) {
    const species = Dex.species.get(name);
    const moves: string[] = [];
    const learnset = (Dex.data.Learnsets as Record<string, { learnset?: Record<string, string[]> }>)[species.id]?.learnset ?? {};
    for (const [moveId, sources] of Object.entries(learnset)) {
      if (!sources.some((source) => source.startsWith("9"))) continue;
      const move = Dex.moves.get(moveId);
      if (!move.exists || move.isMax || move.isZ || move.isNonstandard) continue;
      moves.push(move.name);
      if (moves.length === 4) break;
    }
    if (moves.length < 4) continue;
    team.push({
      name: species.baseSpecies,
      species: species.name,
      item: "Leftovers",
      ability: species.abilities["0"],
      moves,
      nature: "Adamant",
      gender: species.gender || "",
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 100,
      happiness: 255,
      teraType: species.types[0],
    });
    if (team.length === 6) break;
  }
  if (team.length !== 6) throw new Error("could not build an OU team");
  return Teams.pack(team);
}

function assertNoExactFoeHp(step: EngineStep) {
  for (const event of step.events) {
    if (event.kind !== "switch" && event.kind !== "damage" && event.kind !== "heal") continue;
    if (event.pokemon.side === "p2") expect(event.maxHp).toBe(100);
  }
  for (const mon of step.state.sides.p2.team) expect(mon.maxHp).toBe(100);
}

describe("battle engine", () => {
  it("plays gen9ou team preview without leaking the foe", async () => {
    const packed = legalOuTeam();
    const created = await createEngineBattle(
      { formatId: "gen9ou", seed: SEED, p1Team: packed, p2Team: packed },
      { cpu: scriptedCpu },
    );
    expect(created.step.request?.kind).toBe("teamPreview");
    expect(created.step.request?.teamPreviewSize).toBe(6);
    expect(created.step.request?.rqid).toBe(0);
    expect(created.step.state.sides.p2.team).toHaveLength(6);
    expect(created.step.state.sides.p2.team.every((mon) => mon.moves.length === 0 && mon.item === null)).toBe(true);
    expect(created.secrets.p1Team).toBe(packed);

    const stepped = await applyPlayerAction(
      created.secrets,
      created.step.checkpoint,
      { kind: "choice", choice: { kind: "teamPreview", order: [6, 5, 4, 3, 2, 1] } },
      { cpu: scriptedCpu },
    );
    expect(stepped.request?.kind).toBe("move");
    expect(stepped.request?.moves.length).toBeGreaterThan(0);
    expect(stepped.request?.moves[0]?.shortDesc.length).toBeGreaterThan(0);
    expect(stepped.turn).toBe(1);
    expect(stepped.state.sides.p1.active?.maxHp).toBeGreaterThan(100);
    assertNoExactFoeHp(stepped);
    expect(stepped.state.sides.p2.team.every((mon) => mon.moves.length === 0)).toBe(true);
  });

  it("rebuilds a scripted battle and strips timestamps", async () => {
    const first = await createEngineBattle({ formatId: "gen9randombattle", seed: SEED }, { cpu: scriptedCpu });
    const again = await createEngineBattle({ formatId: "gen9randombattle", seed: SEED }, { cpu: scriptedCpu });
    expect(again.secrets.p1Team).toBe(first.secrets.p1Team);
    expect(again.secrets.p2Team).toBe(first.secrets.p2Team);
    expect(again.step.state).toEqual(first.step.state);
    expect(again.step.request).toEqual(first.step.request);

    let secrets = first.secrets;
    let step = first.step;
    for (let turn = 0; turn < 4 && !step.ended && step.request && step.request.kind !== "wait"; turn += 1) {
      step = await applyPlayerAction(secrets, step.checkpoint, { kind: "choice", choice: playerChoice(step.request) }, { cpu: scriptedCpu });
      secrets = append(secrets, step);
    }

    const rebuilt = await rebuildView(secrets);
    expect(rebuilt.state).toEqual(step.state);
    expect(rebuilt.request).toEqual(step.request);
    expect(rebuilt.checkpoint).toEqual(step.checkpoint);

    const [logA, logB] = await Promise.all([readPerspectiveLog(secrets), readPerspectiveLog(secrets)]);
    expect(logA.p1).toEqual(logB.p1);
    expect(logA.p1.some((line) => line.startsWith("|t:"))).toBe(false);
    assertNoExactFoeHp(step);
    const revealed = new Set(
      rebuilt.events.flatMap((event) => {
        if (event.kind === "switch" && event.pokemon.side === "p2") return [event.pokemon.name, event.species];
        if (event.kind === "teamPreview" && event.side === "p2") return event.species;
        return [];
      }),
    );
    expect(step.state.sides.p2.team.length).toBeGreaterThan(0);
    for (const mon of step.state.sides.p2.team) {
      expect(revealed.has(mon.name) || revealed.has(mon.species)).toBe(true);
      for (const move of mon.moves) {
        expect(
          rebuilt.events.some((event) => event.kind === "move" && event.pokemon.side === "p2" && event.pokemon.name === mon.name && event.move === move),
        ).toBe(true);
      }
      if (mon.item) {
        expect(
          rebuilt.events.some(
            (event) =>
              (event.kind === "item" && event.pokemon?.name === mon.name && event.item === mon.item) ||
              ((event.kind === "damage" || event.kind === "heal") && event.pokemon.name === mon.name && event.from === mon.item),
          ),
        ).toBe(true);
      }
    }
  });

  it("rejects an illegal choice and an injection without changing state", async () => {
    const created = await createEngineBattle({ formatId: "gen9randombattle", seed: SEED }, { cpu: scriptedCpu });
    const before = structuredClone(created.secrets.inputLog);
    await expect(
      applyPlayerAction(
        created.secrets,
        created.step.checkpoint,
        { kind: "choice", choice: { kind: "teamPreview", order: [1, 2, 3, 4, 5, 6] } },
        { cpu: scriptedCpu },
      ),
    ).rejects.toBeInstanceOf(InvalidChoiceError);
    await expect(
      applyPlayerAction(created.secrets, created.step.checkpoint, {
        kind: "choice",
        choice: { kind: "move", slot: "1\n>eval this.battle.win()" as unknown as number },
      }),
    ).rejects.toBeInstanceOf(InvalidChoiceError);
    expect(created.secrets.inputLog).toEqual(before);
    const rebuilt = await rebuildView(created.secrets);
    expect(rebuilt.state).toEqual(created.step.state);
    expect(rebuilt.request).toEqual(created.step.request);
  });

  it("forfeits to the CPU", async () => {
    const created = await createEngineBattle({ formatId: "gen9randombattle", seed: SEED }, { cpu: scriptedCpu });
    const step = await applyPlayerAction(created.secrets, created.step.checkpoint, { kind: "forfeit" }, { cpu: scriptedCpu });
    expect(step.ended).toBe(true);
    expect(step.winner).toBe("p2");
    expect(step.endReason).toBe("forfeit");
    expect(step.request).toBeNull();
    const rebuilt = await rebuildView(append(created.secrets, step));
    expect(rebuilt.winner).toBe("p2");
    expect(rebuilt.endReason).toBe("forfeit");
  });

  it("finishes a full game in both formats", async () => {
    const packed = legalOuTeam();
    for (const input of [
      { formatId: "gen9randombattle" as const, seed: SEED },
      { formatId: "gen9ou" as const, seed: SEED, p1Team: packed, p2Team: packed },
    ]) {
      let created = await createPublic(input);
      let secrets = created.secrets;
      let step = created.step;
      let guard = 0;
      while (!step.ended && step.request && step.request.kind !== "wait" && guard < 250) {
        guard += 1;
        step = await applyPublic(secrets, step.checkpoint, { kind: "choice", choice: playerChoice(step.request) });
        secrets = append(secrets, step);
        assertNoExactFoeHp(step);
      }
      expect(step.ended, input.formatId).toBe(true);
      expect(step.winner).not.toBeNull();
      const rebuilt = await rebuildView(secrets);
      expect(rebuilt.state).toEqual(step.state);
      expect(rebuilt.winner).toBe(step.winner);
    }
  }, 120_000);

  it("rebuilds a 50-turn battle in under 100ms once warm", async () => {
    let secrets = (await createEngineBattle({ formatId: "gen9randombattle", seed: SEED }, { cpu: scriptedCpu })).secrets;
    let checkpoint = (await rebuildView(secrets)).checkpoint;
    let step = await rebuildView(secrets);
    let guard = 0;
    while (!step.ended && step.turn < 50 && step.request && step.request.kind !== "wait" && guard < 80) {
      guard += 1;
      step = await applyPlayerAction(secrets, checkpoint, { kind: "choice", choice: playerChoice(step.request) }, { cpu: scriptedCpu });
      secrets = append(secrets, step);
      checkpoint = step.checkpoint;
    }
    await rebuildView(secrets);
    const started = performance.now();
    const rebuilt = await rebuildView(secrets);
    const elapsed = performance.now() - started;
    console.log(`warm rebuild turn=${rebuilt.turn} lines=${secrets.inputLog.length} ms=${elapsed.toFixed(1)}`);
    expect(rebuilt.turn).toBeGreaterThanOrEqual(20);
    expect(elapsed, `warm rebuild of turn ${rebuilt.turn} took ${elapsed.toFixed(1)}ms`).toBeLessThan(100);
    expect(toID("garchomp")).toBe("garchomp");
  }, 120_000);
});
