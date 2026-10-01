import { expect, test } from "vitest";
import { BATTLE_LEAD_COLUMNS, toBattleSummary } from "../../../src/server/persistence/map-battle.ts";

const base = {
  id: "b1",
  format_id: "gen9ou",
  mode: "singleplayer",
  cpu_name: "CPU",
  status: "finished",
  winner: "p1",
  end_reason: "normal",
  turn: 4,
  created_at: "2026-09-30T10:00:00Z",
  updated_at: "2026-09-30T10:05:00Z",
};

test("Lead columns only read the public active Pokémon of the first two frames", () => {
  expect(BATTLE_LEAD_COLUMNS).toContain("p1_species_0:frames->0->state->sides->p1->active->>species");
  expect(BATTLE_LEAD_COLUMNS).toContain("p2_sprite_1:frames->1->state->sides->p2->active->>spriteId");
  expect(BATTLE_LEAD_COLUMNS).not.toContain("request");
});

test("Leads come from frame 0 without team preview and from frame 1 after it", () => {
  const random = toBattleSummary({ ...base, p1_species_0: "Pikachu", p1_sprite_0: "pikachu", p2_species_0: "Ogerpon-Wellspring", p2_sprite_0: "ogerpon-wellspring" });
  expect(random.playerLead).toEqual({ species: "Pikachu", spriteId: "pikachu" });
  expect(random.cpuLead).toEqual({ species: "Ogerpon-Wellspring", spriteId: "ogerpon-wellspring" });

  const preview = toBattleSummary({ ...base, p1_species_0: null, p1_sprite_0: null, p1_species_1: "Forretress", p1_sprite_1: "forretress", p2_species_1: "Magikarp", p2_sprite_1: "magikarp" });
  expect(preview.playerLead?.species).toBe("Forretress");
  expect(preview.cpuLead?.spriteId).toBe("magikarp");
});

test("A battle still in team preview has no leads", () => {
  const summary = toBattleSummary({ ...base, status: "active", winner: null, end_reason: null, turn: 0 });
  expect(summary.playerLead).toBeNull();
  expect(summary.cpuLead).toBeNull();
});

test("Online summaries carry the mode and the rival name", () => {
  const summary = toBattleSummary({ ...base, mode: "online", cpu_name: "Misty" });
  expect(summary.mode).toBe("online");
  expect(summary.opponentName).toBe("Misty");
});
