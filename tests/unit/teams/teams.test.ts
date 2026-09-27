import { describe, expect, it } from "vitest";
import { getSpeciesDetail, listNatures, listTypes, searchSpecies } from "../../../src/server/teams/dex.ts";
import { exportTeam, importTeam, normalizeSet, packTeam, unpackTeam } from "../../../src/server/teams/format.ts";
import { generateRandomOuTeam } from "../../../src/server/teams/random-ou.ts";
import { validateTeam } from "../../../src/server/teams/validation.ts";
import type { PokemonSetData } from "../../../src/shared/contract/team.ts";

const PASTE = `Garchomp @ Leftovers
Ability: Rough Skin
Tera Type: Ground
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Swords Dance
- Scale Shot
- Protect

Toxapex @ Black Sludge
Ability: Regenerator
Tera Type: Water
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
IVs: 0 Atk
- Recover
- Toxic
- Baneful Bunker
- Surf
`;

describe("random OU teams", () => {
  it("generates 30 valid teams of 6 unique species", () => {
    for (let index = 0; index < 30; index += 1) {
      const team = generateRandomOuTeam(`ou-team-${index}`);
      expect(team).toHaveLength(6);
      expect(new Set(team.map((set) => set.name)).size).toBe(6);
      const result = validateTeam("gen9ou", team);
      expect(result.problems, JSON.stringify(result.problems)).toEqual([]);
      expect(result.valid).toBe(true);
      for (const set of team) {
        expect(set.level).toBe(100);
        expect(set.shiny).toBe(false);
        expect(set.teraType.length).toBeGreaterThan(0);
        expect(Object.values(set.evs).every((ev) => ev === 84)).toBe(true);
      }
    }
    const again = generateRandomOuTeam("ou-team-0");
    const first = generateRandomOuTeam("ou-team-0");
    expect(again).toEqual(first);
  });
});

describe("team format", () => {
  it("round-trips a Showdown paste and a packed team", () => {
    const imported = importTeam(PASTE);
    expect(imported.map((set) => set.species)).toEqual(["Garchomp", "Toxapex"]);
    expect(imported[0]?.nature).toBe("Jolly");
    expect(imported[0]?.moves).toEqual(["Earthquake", "Swords Dance", "Scale Shot", "Protect"]);
    expect(imported[1]?.ivs.atk).toBe(0);
    expect(imported[1]?.ivs.hp).toBe(31);
    expect(imported[1]?.nature).toBe("Bold");
    const exported = importTeam(exportTeam(imported));
    expect(exported).toEqual(imported);
    expect(unpackTeam(packTeam(imported))).toEqual(imported);
  });

  it("clamps dangerous or out-of-range set data", () => {
    const dirty = normalizeSet({
      name: `${"A".repeat(40)}|bad`,
      species: "Pikachu",
      ability: "Static",
      item: "Light Ball",
      nature: "Timid",
      teraType: "Electric",
      gender: "",
      shiny: false,
      level: 500,
      moves: ["Thunderbolt", "Quick Attack", "Iron Tail", "Electro Ball", "Surf", "Fly"],
      evs: { hp: 999, atk: 999, def: 999, spa: 999, spd: 999, spe: 999 },
      ivs: { hp: 99, atk: -5, def: 31, spa: 31, spd: 31, spe: 31 },
    });
    expect(dirty.name.length).toBeLessThanOrEqual(18);
    expect(dirty.name.includes("|")).toBe(false);
    expect(dirty.moves.length).toBeLessThanOrEqual(4);
    expect(dirty.level).toBe(100);
    expect(dirty.ivs.hp).toBe(31);
    expect(dirty.ivs.atk).toBe(0);
    const total = Object.values(dirty.evs).reduce((sum, ev) => sum + ev, 0);
    expect(total).toBeLessThanOrEqual(510);
    for (const ev of Object.values(dirty.evs)) {
      expect(ev).toBeGreaterThanOrEqual(0);
      expect(ev).toBeLessThanOrEqual(252);
    }

    const huge = "Pikachu @ Light Ball\nAbility: Static\n- Tackle\n\n".repeat(2000);
    expect(huge.length).toBeGreaterThan(20_000);
    expect(importTeam(huge).length).toBeLessThanOrEqual(6);
  });
});

describe("team validation", () => {
  it("rejects random battle teams and maps an illegal move onto its set", () => {
    expect(validateTeam("gen9randombattle", [])).toEqual({
      valid: false,
      problems: [{ setIndex: null, message: "Random Battle usa equipos generados" }],
    });

    const empty = validateTeam("gen9ou", []);
    expect(empty.valid).toBe(false);
    expect(empty.problems.some((problem) => problem.setIndex === null && problem.message.includes("vacío"))).toBe(true);
    expect(empty.problems.some((problem) => problem.message.includes("at least 1"))).toBe(true);

    const pikachu: PokemonSetData = {
      name: "Pikachu",
      species: "Pikachu",
      item: "Light Ball",
      ability: "Static",
      moves: ["Thunderbolt", "Frenzy Plant", "Surf", "Quick Attack"],
      nature: "Timid",
      gender: "",
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 100,
      shiny: false,
      teraType: "Electric",
    };
    const garchomp: PokemonSetData = {
      name: "Garchomp",
      species: "Garchomp",
      item: "Leftovers",
      ability: "Rough Skin",
      moves: ["Earthquake", "Swords Dance", "Scale Shot", "Protect"],
      nature: "Jolly",
      gender: "",
      evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 100,
      shiny: false,
      teraType: "Ground",
    };
    const result = validateTeam("gen9ou", [pikachu, garchomp]);
    expect(result.valid).toBe(false);
    expect(result.problems.some((problem) => problem.setIndex === 0 && /Frenzy Plant/i.test(problem.message))).toBe(true);
  });
});

describe("dex lookups", () => {
  it("finds Garchomp and Earthquake, and lists Stellar", () => {
    const found = searchSpecies("garch");
    expect(found.some((species) => species.id === "garchomp")).toBe(true);
    const detail = getSpeciesDetail("garchomp");
    expect(detail.species.name).toBe("Garchomp");
    expect(detail.moves.some((move) => move.id === "earthquake")).toBe(true);
    const types = listTypes();
    expect(types).toHaveLength(19);
    expect(types.some((type) => type.id === "stellar")).toBe(true);
    const serious = listNatures().find((nature) => nature.id === "serious");
    expect(serious?.plus).toBeNull();
    expect(serious?.minus).toBeNull();
    const popular = searchSpecies("");
    expect(popular.length).toBe(40);
    expect(popular[0]?.tier).toBe("OU");
  });
});
