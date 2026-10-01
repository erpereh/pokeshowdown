import { describe, expect, it } from "vitest";
import type { PlayerChoice, PlayerRequest, PublicBattleState } from "../../../src/shared/contract/battle.ts";
import type { EngineSecrets } from "../../../src/server/battle-engine/contract.ts";
import { InvalidChoiceError } from "../../../src/server/battle-engine/contract.ts";
import { applyOnlineAction, createOnlineEngineBattle, type OnlineStep } from "../../../src/server/battle-engine/online.ts";
import { mirrorEvents, mirrorState } from "../../../src/server/battle-engine/perspective.ts";
import { Dex, Teams } from "../../../src/server/showdown/module.ts";

const SEED = "sodium,00112233445566778899aabbccddeeff";

function firstChoice(request: PlayerRequest): PlayerChoice {
  if (request.kind === "teamPreview") {
    return { kind: "teamPreview", order: Array.from({ length: request.teamPreviewSize }, (_, index) => index + 1) };
  }
  if (request.kind === "switch") {
    const option = request.switches.find((entry) => !entry.disabled);
    if (!option) throw new Error("no switch");
    return { kind: "switch", slot: option.slot };
  }
  const option = request.moves.find((entry) => !entry.disabled);
  if (!option) throw new Error("no move");
  return { kind: "move", slot: option.slot };
}

function append(secrets: EngineSecrets, step: OnlineStep): EngineSecrets {
  return { ...secrets, inputLog: [...secrets.inputLog, ...step.inputLogDelta] };
}

function ouTeam(): string {
  const names = ["Kingambit", "Great Tusk", "Dragapult", "Gholdengo", "Corviknight", "Toxapex", "Ting-Lu"];
  const team = [];
  for (const name of names) {
    const species = Dex.species.get(name);
    const learnset = (Dex.data.Learnsets as Record<string, { learnset?: Record<string, string[]> }>)[species.id]?.learnset ?? {};
    const moves = Object.entries(learnset)
      .filter(([, sources]) => sources.some((source) => source.startsWith("9")))
      .map(([id]) => Dex.moves.get(id))
      .filter((move) => move.exists && !move.isNonstandard && move.category !== "Status")
      .slice(0, 4)
      .map((move) => move.name);
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
      teraType: species.types[0],
    });
    if (team.length === 6) break;
  }
  return Teams.pack(team);
}

function assertViewerIsP1(state: PublicBattleState) {
  for (const mon of state.sides.p2.team) expect(mon.maxHp).toBe(100);
  expect(state.sides.p1.id).toBe("p1");
  expect(state.sides.p2.id).toBe("p2");
}

describe("online engine", () => {
  it("needs both team previews, waits for the rival and resolves turns for both seats", async () => {
    const team = ouTeam();
    const created = await createOnlineEngineBattle({ formatId: "gen9ou", seed: SEED, p1Team: team, p2Team: team });
    let secrets = created.secrets;
    let step = created.step;
    expect(step.pending).toEqual({ p1: true, p2: true });
    expect(step.seats.p1.request?.kind).toBe("teamPreview");
    expect(step.seats.p2.request?.kind).toBe("teamPreview");
    assertViewerIsP1(step.seats.p1.state);
    assertViewerIsP1(step.seats.p2.state);

    const p1Preview = await applyOnlineAction(secrets, step.checkpoint, {
      kind: "choice",
      side: "p1",
      choice: firstChoice(step.seats.p1.request!),
    });
    expect(p1Preview.advanced).toBe(false);
    expect(p1Preview.pending).toEqual({ p1: false, p2: true });
    expect(p1Preview.seats.p1.request?.kind).toBe("wait");
    secrets = append(secrets, p1Preview);
    step = p1Preview;

    await expect(
      applyOnlineAction(secrets, step.checkpoint, { kind: "choice", side: "p1", choice: { kind: "teamPreview", order: [1, 2, 3, 4, 5, 6] } }),
    ).rejects.toBeInstanceOf(InvalidChoiceError);

    const p2Preview = await applyOnlineAction(secrets, step.checkpoint, {
      kind: "choice",
      side: "p2",
      choice: firstChoice(step.seats.p2.request!),
    });
    expect(p2Preview.advanced).toBe(true);
    expect(p2Preview.turn).toBe(1);
    expect(p2Preview.pending).toEqual({ p1: true, p2: true });
    expect(p2Preview.seats.p1.request?.kind).toBe("move");
    expect(p2Preview.seats.p2.request?.kind).toBe("move");
    assertViewerIsP1(p2Preview.seats.p1.state);
    assertViewerIsP1(p2Preview.seats.p2.state);
    expect(p2Preview.seats.p2.state.sides.p1.active?.maxHp).toBeGreaterThan(100);
  });

  it("plays a random battle to a natural end with both seats", async () => {
    const created = await createOnlineEngineBattle({ formatId: "gen9randombattle", seed: SEED });
    let secrets = created.secrets;
    let step = created.step;
    let actions = 0;
    while (!step.ended && actions < 600) {
      const side = step.pending.p1 ? "p1" : "p2";
      step = await applyOnlineAction(secrets, step.checkpoint, {
        kind: "choice",
        side,
        choice: firstChoice(step.seats[side].request!),
      });
      secrets = append(secrets, step);
      assertViewerIsP1(step.seats.p1.state);
      assertViewerIsP1(step.seats.p2.state);
      actions += 1;
    }
    expect(step.ended).toBe(true);
    expect(step.endReason).toBe("normal");
    expect(["p1", "p2", "tie"]).toContain(step.winner);
    expect(step.seats.p1.request).toBeNull();
  });

  it("forfeits and times out through Showdown commands", async () => {
    const created = await createOnlineEngineBattle({ formatId: "gen9randombattle", seed: SEED });
    expect(created.step.seats.p1.request?.kind).toBe("move");
    const forfeit = await applyOnlineAction(created.secrets, created.step.checkpoint, { kind: "forfeit", side: "p2" });
    expect(forfeit).toMatchObject({ ended: true, winner: "p1", endReason: "forfeit", advanced: true });
    expect(forfeit.seats.p2.events.some((event) => event.kind === "win" && event.winner === "p2")).toBe(true);

    const single = await applyOnlineAction(created.secrets, created.step.checkpoint, { kind: "timeout", sides: ["p1"] });
    expect(single).toMatchObject({ ended: true, winner: "p2", endReason: "timeout" });
    const both = await applyOnlineAction(created.secrets, created.step.checkpoint, { kind: "timeout", sides: ["p1", "p2"] });
    expect(both).toMatchObject({ ended: true, winner: "tie", endReason: "timeout" });
  });

  it("mirrors perspectives as an involution without touching names", () => {
    const state: PublicBattleState = {
      turn: 3,
      field: { weather: null, terrain: null, pseudoWeather: [] },
      sides: {
        p1: { id: "p1", name: "p2", teamSize: 6, active: null, team: [], conditions: [], canTerastallize: true },
        p2: { id: "p2", name: "Rival", teamSize: 6, active: null, team: [], conditions: [{ id: "spikes", name: "Spikes", layers: 1 }], canTerastallize: false },
      },
    };
    const mirrored = mirrorState(state);
    expect(mirrored.sides.p1).toMatchObject({ id: "p1", name: "Rival" });
    expect(mirrored.sides.p2).toMatchObject({ id: "p2", name: "p2" });
    expect(mirrorState(mirrored)).toEqual(state);
    const events = mirrorEvents([
      { kind: "faint", pokemon: { side: "p1", name: "p1" }, text: "" },
      { kind: "win", winner: "p2", text: "" },
      { kind: "sideStart", side: "p1", effect: "Spikes", text: "" },
    ]);
    expect(events).toEqual([
      { kind: "faint", pokemon: { side: "p2", name: "p1" }, text: "" },
      { kind: "win", winner: "p1", text: "" },
      { kind: "sideStart", side: "p2", effect: "Spikes", text: "" },
    ]);
  });
});
