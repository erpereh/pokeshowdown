import { describe, expect, it } from "vitest";
import { choiceToProtocol } from "../../../src/server/battle-engine/choices.ts";
import { InvalidChoiceError } from "../../../src/server/battle-engine/contract.ts";
import { parseProtocol } from "../../../src/server/battle-engine/protocol-parser.ts";
import { spriteIdForSpecies } from "../../../src/server/battle-engine/sprite-id.ts";
import { reduceBattleState } from "../../../src/server/battle-engine/state-tracker.ts";
import { BattleSession } from "../../../src/server/battle-engine/stream.ts";

describe("sprite ids", () => {
  it("uses base species and forme", () => {
    expect(spriteIdForSpecies("Garchomp")).toBe("garchomp");
    expect(spriteIdForSpecies("Rotom-Wash")).toBe("rotom-wash");
    expect(spriteIdForSpecies("Indeedee-F")).toBe("indeedee-f");
  });
});

describe("protocol parser", () => {
  const lines = [
    "|poke|p1|Garchomp, M|item",
    "|poke|p2|Dragapult, F|item",
    "|teampreview",
    "|switch|p1a: Garchomp|Garchomp, M|301/301",
    "|switch|p2a: Dragapult|Dragapult, F|100/100",
    "|turn|1",
    "|-terastallize|p1a: Garchomp|Ground",
    "|move|p1a: Garchomp|Tera Blast|p2a: Dragapult",
    "|-supereffective|p2a: Dragapult",
    "|-crit|p2a: Dragapult",
    "|-damage|p2a: Dragapult|40/100",
    "|move|p2a: Dragapult|Dragon Darts|p1a: Garchomp|[miss]",
    "|-miss|p2a: Dragapult",
    "|-weather|RainDance",
    "|-sidestart|p2: CPU|move: Stealth Rock",
    "|-boost|p1a: Garchomp|atk|2",
    "|-status|p2a: Dragapult|brn",
    "|-heal|p1a: Garchomp|301/301|[from] item: Leftovers",
    "|faint|p2a: Dragapult",
    "|turn|3",
    "|win|Player",
  ];

  it("maps sample lines to Spanish events without throwing", () => {
    const events = parseProtocol(lines, "p1", "gen9ou");
    expect(events.find((event) => event.kind === "turn" && event.turn === 3)?.text).toBe("¡Turno 3!");
    const move = events.find((event) => event.kind === "move" && event.move === "Tera Blast");
    expect(move).toMatchObject({
      kind: "move",
      moveType: "Ground",
      category: "Special",
      text: "¡Garchomp usó Tera Blast!",
    });
    expect(move && move.kind === "move" ? move.flags.length : 0).toBeGreaterThan(0);
    expect(events.find((event) => event.kind === "effectiveness")).toMatchObject({
      value: "super",
      text: "¡Es muy eficaz!",
    });
    expect(events.find((event) => event.kind === "crit")?.text).toBe("¡Golpe crítico!");
    expect(events.find((event) => event.kind === "faint")?.text).toBe("El Dragapult rival se debilitó.");
    expect(events.find((event) => event.kind === "weather")).toMatchObject({
      weather: "RainDance",
      text: "Empieza a llover.",
    });
    const foeSwitch = events.find((event) => event.kind === "switch" && event.pokemon.side === "p2");
    expect(foeSwitch).toMatchObject({ maxHp: 100, hp: 100, spriteId: "dragapult" });
    const ownSwitch = events.find((event) => event.kind === "switch" && event.pokemon.side === "p1");
    expect(ownSwitch).toMatchObject({ maxHp: 301, hp: 301, spriteId: "garchomp" });
    expect(events.find((event) => event.kind === "move" && event.move === "Dragon Darts")).toMatchObject({ missed: true });
    expect(events.some((event) => event.kind === "win" && event.winner === "p1")).toBe(true);
  });

  it("skips unknown lines", () => {
    expect(parseProtocol(["|totally-unknown|foo", "|-hint|secret", ""], "p1", "gen9ou")).toEqual([]);
  });

  it("tracks public state from the event list", () => {
    const state = reduceBattleState(parseProtocol(lines, "p1", "gen9ou"));
    expect(state.turn).toBe(3);
    expect(state.field.weather).toBe("RainDance");
    expect(state.sides.p2.team).toHaveLength(1);
    expect(state.sides.p2.team[0]).toMatchObject({
      name: "Dragapult",
      fainted: true,
      maxHp: 100,
      status: null,
      moves: ["Dragon Darts"],
    });
    expect(state.sides.p2.conditions[0]).toMatchObject({ id: "stealthrock", layers: 1 });
    expect(state.sides.p1.active).toMatchObject({
      name: "Garchomp",
      terastallized: "Ground",
      item: "Leftovers",
      boosts: { atk: 2 },
    });
    expect(state.sides.p2.canTerastallize).toBe(true);
  });
});

describe("choice protocol", () => {
  it("rejects newlines and eval before any stream write", async () => {
    expect(() => choiceToProtocol({ kind: "move", slot: "1\n>eval process.exit(1)" as unknown as number })).toThrow(InvalidChoiceError);
    expect(() => choiceToProtocol({ kind: "teamPreview", order: [1, 2, 3, 4, 5, 6, 1] })).toThrow(InvalidChoiceError);
    expect(choiceToProtocol({ kind: "move", slot: 1, terastallize: true })).toBe("move 1 terastallize");
    expect(choiceToProtocol({ kind: "teamPreview", order: [6, 5, 4, 3, 2, 1] })).toBe("team 654321");

    const session = new BattleSession();
    try {
      await expect(session.writeLine(">p1 move 1\n>eval this.battle.win()")).rejects.toBeInstanceOf(InvalidChoiceError);
      await expect(session.writeLine(">eval process.exit(1)")).rejects.toBeInstanceOf(InvalidChoiceError);
      expect(session.stream.battle).toBeNull();
    } finally {
      await session.destroy();
    }
  });
});
