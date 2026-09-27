import { describe, expect, it } from "vitest";
import type { ActivePokemonView, PublicBattleState, SideView } from "../../../src/shared/contract/battle.ts";
import { CHOICE_PATTERN, type CpuInput, type ShowdownRequest } from "../../../src/server/cpu/contract.ts";
import { chooseCpuActions } from "../../../src/server/cpu/index.ts";

const ATTACK_STATS = { atk: 300, def: 200, spa: 180, spd: 180, spe: 200 };

function foe(species: string, types: string[], ability: string | null = null): ActivePokemonView {
  return {
    slot: 1,
    name: species,
    species,
    spriteId: species.toLowerCase(),
    level: 100,
    gender: "N",
    shiny: false,
    hp: 200,
    maxHp: 200,
    status: null,
    fainted: false,
    active: true,
    types,
    teraType: null,
    terastallized: null,
    item: null,
    itemSpriteNum: null,
    ability,
    moves: [],
    boosts: {},
    volatiles: [],
  };
}

function side(id: "p1" | "p2", name: string, active: ActivePokemonView | null): SideView {
  return {
    id,
    name,
    teamSize: active ? 1 : 0,
    active,
    team: active ? [active] : [],
    conditions: [],
    canTerastallize: false,
  };
}

function view(opponent: ActivePokemonView | null): PublicBattleState {
  return {
    turn: 1,
    field: { weather: null, terrain: null, pseudoWeather: [] },
    sides: {
      p1: side("p1", "Foe", opponent),
      p2: side("p2", "CPU", null),
    },
  };
}

function pokemon(
  details: string,
  options: Partial<ShowdownRequest["side"]["pokemon"][number]> = {},
): ShowdownRequest["side"]["pokemon"][number] {
  return {
    ident: "p2a: Mon",
    details,
    condition: "300/300",
    active: true,
    stats: { ...ATTACK_STATS },
    moves: ["earthquake"],
    baseAbility: "pressure",
    ability: "pressure",
    item: "leftovers",
    teraType: "Ground",
    terastallized: "",
    ...options,
  };
}

function input(request: ShowdownRequest, opponent: ActivePokemonView | null, seedKey = "unit"): CpuInput {
  return { formatId: "gen9ou", self: "p2", request, view: view(opponent), seedKey };
}

function assertChoices(choices: string[]) {
  expect(choices.length).toBeGreaterThan(0);
  expect(choices[choices.length - 1]).toBe("default");
  for (const choice of choices) expect(choice).toMatch(CHOICE_PATTERN);
}

describe("chooseCpuActions", () => {
  it("prefers a super-effective move", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [
          { move: "Earthquake", id: "earthquake", disabled: false },
          { move: "Dragon Claw", id: "dragonclaw", disabled: false },
        ],
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [pokemon("Garchomp, L100, M", { moves: ["earthquake", "dragonclaw"] })],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Blastoise", ["Water"])));
    assertChoices(choices);
    expect(choices[0]).toBe("move 1");
    expect(choices).toEqual(chooseCpuActions(input(request, foe("Blastoise", ["Water"]))));
  });

  it("avoids a move the foe is immune to", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [
          { move: "Earthquake", id: "earthquake", disabled: false },
          { move: "Dragon Claw", id: "dragonclaw", disabled: false },
        ],
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [pokemon("Garchomp, L100, M", { moves: ["earthquake", "dragonclaw"] })],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Skarmory", ["Steel", "Flying"])));
    assertChoices(choices);
    expect(choices[0]).toBe("move 2");
    expect(choices.indexOf("move 2")).toBeLessThan(choices.indexOf("move 1"));
  });

  it("returns only switches when forced to switch", () => {
    const request: ShowdownRequest = {
      forceSwitch: [true],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [
          pokemon("Garchomp, L100, M", { condition: "0 fnt", active: true }),
          pokemon("Rillaboom, L100, M", {
            ident: "p2: Rillaboom",
            condition: "300/300",
            active: false,
            moves: ["grassyglide"],
          }),
          pokemon("Skarmory, L100, M", {
            ident: "p2: Skarmory",
            condition: "0 fnt",
            active: false,
          }),
        ],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Blastoise", ["Water"])));
    assertChoices(choices);
    expect(choices.filter((choice) => choice.startsWith("move"))).toEqual([]);
    expect(choices).toContain("switch 2");
    expect(choices).not.toContain("switch 1");
    expect(choices).not.toContain("switch 3");
  });

  it("excludes disabled moves", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [
          { move: "Earthquake", id: "earthquake", disabled: true },
          { move: "Dragon Claw", id: "dragonclaw", disabled: false },
        ],
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [pokemon("Garchomp, L100, M")],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Blastoise", ["Water"])));
    assertChoices(choices);
    expect(choices).not.toContain("move 1");
    expect(choices[0]).toBe("move 2");
  });

  it("does not switch when trapped", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [
          { move: "Earthquake", id: "earthquake", disabled: false },
          { move: "Dragon Claw", id: "dragonclaw", disabled: false },
        ],
        trapped: true,
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [
          pokemon("Charizard, L100, M", { moves: ["ember"], stats: { ...ATTACK_STATS, spa: 200 } }),
          pokemon("Rillaboom, L100, M", { ident: "p2: Rillaboom", active: false, moves: ["woodhammer"] }),
        ],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Swampert", ["Water", "Ground"])));
    assertChoices(choices);
    expect(choices.some((choice) => choice.startsWith("switch"))).toBe(false);
  });

  it("returns a team-preview permutation", () => {
    const party = ["Garchomp", "Dragapult", "Great Tusk", "Iron Valiant", "Slowking", "Toxapex"].map((species, index) => (
      pokemon(`${species}, L100`, {
        ident: `p2: ${species}`,
        active: false,
        moves: ["protect"],
      })
    ));
    const request: ShowdownRequest = {
      teamPreview: true,
      side: { name: "CPU", id: "p2", pokemon: party },
    };
    const opponent = foe("Pelipper", ["Water", "Flying"]);
    const choices = chooseCpuActions(input(request, opponent, "preview"));
    assertChoices(choices);
    const team = choices.find((choice) => choice.startsWith("team "));
    expect(team).toBeTruthy();
    const digits = team!.slice(5);
    expect(digits).toHaveLength(6);
    expect(new Set(digits.split(""))).toEqual(new Set(["1", "2", "3", "4", "5", "6"]));
  });

  it("terastallizes when the best move gains STAB", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [
          { move: "Earthquake", id: "earthquake", disabled: false },
          { move: "Dragon Claw", id: "dragonclaw", disabled: false },
        ],
        canTerastallize: "Ground",
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [pokemon("Garchomp, L100, M", { moves: ["earthquake", "dragonclaw"], teraType: "Ground" })],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Blastoise", ["Water"])));
    assertChoices(choices);
    expect(choices[0]).toBe("move 1 terastallize");
    expect(choices).toContain("move 1");
  });

  it("switches out of a bad matchup", () => {
    const request: ShowdownRequest = {
      active: [{
        moves: [{ move: "Ember", id: "ember", disabled: false }],
      }],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [
          pokemon("Charizard, L100, M", {
            moves: ["ember"],
            stats: { atk: 150, def: 160, spa: 200, spd: 170, spe: 200 },
            teraType: "Fire",
          }),
          pokemon("Rillaboom, L100, M", {
            ident: "p2: Rillaboom",
            active: false,
            moves: ["woodhammer"],
            teraType: "Grass",
          }),
        ],
      },
    };
    const choices = chooseCpuActions(input(request, foe("Swampert", ["Water", "Ground"])));
    assertChoices(choices);
    expect(choices[0]).toBe("switch 2");
  });

  it("returns default for garbage, default for revival, and nothing while waiting", () => {
    expect(chooseCpuActions(undefined as unknown as CpuInput)).toEqual(["default"]);
    expect(chooseCpuActions({} as CpuInput)).toEqual(["default"]);
    expect(chooseCpuActions({
      formatId: "gen9ou",
      self: "p2",
      request: { side: { pokemon: "nope" } },
      view: null,
      seedKey: "bad",
    } as unknown as CpuInput)).toEqual(["default"]);

    const waiting = chooseCpuActions(input({
      wait: true,
      side: { name: "CPU", id: "p2", pokemon: [] },
    }, null));
    expect(waiting).toEqual([]);

    const reviving = chooseCpuActions(input({
      forceSwitch: [true],
      side: {
        name: "CPU",
        id: "p2",
        pokemon: [pokemon("Garchomp, L100, M", { condition: "0 fnt", reviving: true })],
      },
    }, null));
    expect(reviving).toEqual(["default"]);
  });
});
