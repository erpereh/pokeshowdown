import { describe, expect, it } from "vitest";
import type { PlayerChoice } from "../../../src/shared/contract/battle.ts";
import type { EngineSecrets, EngineStep } from "../../../src/server/battle-engine/contract.ts";
import { InvalidChoiceError } from "../../../src/server/battle-engine/contract.ts";
import { applyPlayerAction, createEngineBattle, rebuildView, readPerspectiveLog } from "../../../src/server/battle-engine/engine.ts";
import { playerChoiceSchema } from "../../../src/server/http/schemas.ts";
import { Teams, TeamValidator } from "../../../src/server/showdown/module.ts";
import { chooseCpuActions } from "../../../src/server/cpu/index.ts";

const SEED = "sodium,0123456789abcdef0123456789abcdef";

function team(text: string): string {
  const sets = Teams.import(text);
  if (!sets) throw new Error("Invalid test team");
  for (const set of sets) set.evs = { hp: 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  expect(new TeamValidator("gen9ou").validateTeam(sets)).toBeNull();
  return Teams.pack(sets);
}

function revivalTeam(): string {
  return team(`Glimmora
Ability: Toxic Debris
- Memento

Pawmot
Ability: Natural Cure
Tera Type: Flying
- Revival Blessing
- Nuzzle

Corviknight
Ability: Pressure
- Roost`);
}

function passiveTeam(): string {
  return team(`Magikarp
Ability: Swift Swim
- Splash`);
}

function advance(secrets: EngineSecrets, step: EngineStep, choice: PlayerChoice) {
  return applyPlayerAction(secrets, step.checkpoint, { kind: "choice", choice }, { cpu: () => ["default"] });
}

function append(secrets: EngineSecrets, step: EngineStep): EngineSecrets {
  return { ...secrets, inputLog: [...secrets.inputLog, ...step.inputLogDelta] };
}

describe("Revival Blessing integration", () => {
  it("revives the selected fainted bench Pokémon, preserving the active Pokémon and replay", async () => {
    const created = await createEngineBattle({ formatId: "gen9ou", seed: SEED, p1Team: revivalTeam(), p2Team: passiveTeam() }, { cpu: () => ["default"] });
    let secrets = created.secrets;
    let step = created.step;
    expect(step.request?.teamPreviewSize).toBe(3);
    expect(step.state.sides.p1.teamSize).toBe(3);
    expect(step.state.sides.p2.teamSize).toBe(1);
    expect(playerChoiceSchema.safeParse({ kind: "teamPreview", order: [1, 2, 3] }).success).toBe(true);
    expect(playerChoiceSchema.safeParse({ kind: "teamPreview", order: [1, 3] }).success).toBe(false);
    await expect(advance(secrets, step, { kind: "teamPreview", order: [1] })).rejects.toBeInstanceOf(InvalidChoiceError);

    step = await advance(secrets, step, { kind: "teamPreview", order: [1, 2, 3] });
    secrets = append(secrets, step);
    step = await advance(secrets, step, { kind: "move", slot: 1 });
    secrets = append(secrets, step);
    expect(step.request).toMatchObject({ kind: "switch", reviving: false });
    expect(step.state.sides.p1.team.find((pokemon) => pokemon.species === "Glimmora")?.fainted).toBe(true);
    step = await advance(secrets, step, { kind: "switch", slot: 2 });
    secrets = append(secrets, step);
    step = await advance(secrets, step, { kind: "move", slot: 1, terastallize: true });
    secrets = append(secrets, step);
    expect(step.events.some((event) => event.kind === "terastallize" && event.teraType === "Flying")).toBe(true);
    expect(step.request).toMatchObject({ kind: "switch", reviving: true });
    expect(step.request?.switches.filter((option) => !option.disabled)).toEqual([
      expect.objectContaining({ slot: 2, species: "Glimmora", reason: null }),
    ]);
    expect(step.request?.switches.filter((option) => option.disabled).every((option) => option.reason === "notFainted")).toBe(true);
    const revivedSlot = step.request?.switches.find((option) => !option.disabled)?.slot;
    if (!revivedSlot) throw new Error("Revival selection missing");
    await expect(advance(secrets, step, { kind: "switch", slot: 1 })).rejects.toBeInstanceOf(InvalidChoiceError);
    step = await advance(secrets, step, { kind: "switch", slot: revivedSlot });
    secrets = append(secrets, step);
    expect(step.request?.reviving).toBe(false);
    expect(step.state.sides.p1.active).toMatchObject({ species: "Pawmot", terastallized: "Flying" });
    const revived = step.state.sides.p1.team.find((pokemon) => pokemon.species === "Glimmora");
    expect(revived?.fainted).toBe(false);
    expect(revived?.hp).toBe(Math.floor((revived?.maxHp ?? 0) / 2));
    expect(step.events).toContainEqual(expect.objectContaining({ kind: "heal", pokemon: { side: "p1", name: "Glimmora" }, from: "Revival Blessing" }));
    const rebuilt = await rebuildView(secrets);
    expect(rebuilt.state).toEqual(step.state);
    expect(rebuilt.request).toEqual(step.request);
    expect(rebuilt.checkpoint).toEqual(step.checkpoint);
    const log = await readPerspectiveLog(secrets);
    expect(log.p1.some((line) => line.startsWith("|-heal|p1: Glimmora|"))).toBe(true);
  });

  it("lets the production CPU resolve Revival Blessing through the official default selection", async () => {
    const created = await createEngineBattle({ formatId: "gen9ou", seed: SEED, p1Team: passiveTeam(), p2Team: revivalTeam() }, { cpu: () => ["default"] });
    let secrets = created.secrets;
    let step = await advance(secrets, created.step, { kind: "teamPreview", order: [1] });
    secrets = append(secrets, step);
    step = await advance(secrets, step, { kind: "move", slot: 1 });
    secrets = append(secrets, step);
    expect(step.state.sides.p2.active?.species).toBe("Pawmot");
    const cpuRequests: boolean[] = [];
    step = await applyPlayerAction(secrets, step.checkpoint, { kind: "choice", choice: { kind: "move", slot: 1 } }, {
      cpu: (input) => {
        cpuRequests.push(input.request.side.pokemon.some((pokemon) => pokemon.reviving));
        return chooseCpuActions(input);
      },
    });
    secrets = append(secrets, step);
    expect(cpuRequests).toContain(true);
    expect(step.state.sides.p2.active?.species).toBe("Pawmot");
    expect(step.state.sides.p2.team.find((pokemon) => pokemon.species === "Glimmora")).toMatchObject({ hp: 50, maxHp: 100, fainted: false });
    expect(step.events).toContainEqual(expect.objectContaining({ kind: "heal", pokemon: { side: "p2", name: "Glimmora" }, hp: 50, maxHp: 100 }));
    expect((await rebuildView(secrets)).state).toEqual(step.state);
  });
});
