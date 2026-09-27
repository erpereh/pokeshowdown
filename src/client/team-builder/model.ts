import type { NatureEntry, PokemonSetData, SpeciesDetail, StatId, StatTable, TeamRecord, ValidationProblem } from "@/shared/contract";

export const FORMAT_ID = "gen9ou" as const;
export const SLOT_COUNT = 6;
export const MOVE_SLOTS = 4;
export const EV_MAX = 252;
export const EV_TOTAL = 510;
export const IV_MAX = 31;
export const TEAM_NAME_MAX = 40;
export const NICKNAME_MAX = 30;

export const IMPORTED_SETS_KEY = "pokeshowdown.team-import";

export const STAT_IDS: readonly StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export const STAT_LABEL: Record<StatId, string> = {
  hp: "PS",
  atk: "Ataque",
  def: "Defensa",
  spa: "At. Esp.",
  spd: "Def. Esp.",
  spe: "Velocidad",
};

export const ZERO_EVS: StatTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
export const PERFECT_IVS: StatTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export const EV_PRESETS: readonly { id: string; label: string; evs: StatTable }[] = [
  { id: "phys-fast", label: "Físico veloz", evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } },
  { id: "spec-fast", label: "Especial veloz", evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 } },
  { id: "phys-bulk", label: "Tanque físico", evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 } },
  { id: "spec-bulk", label: "Tanque especial", evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 } },
  { id: "balanced", label: "Equilibrado", evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 } },
];

/** Unsaved starter passed to `TeamEditor`. A saved team is a `TeamRecord`. */
export interface TeamDraft {
  id: null;
  name: string;
  formatId: typeof FORMAT_ID;
  sets: PokemonSetData[];
}

export type TeamEditorInitial = TeamRecord | TeamDraft;

export function isTeamRecord(value: TeamEditorInitial): value is TeamRecord {
  return value.id !== null;
}

export function toSpeciesId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function statTable(source: Partial<StatTable> | undefined, max: number, fallback: number): StatTable {
  const read = (stat: StatId) => clampInt(source?.[stat] ?? fallback, 0, max);
  return { hp: read("hp"), atk: read("atk"), def: read("def"), spa: read("spa"), spd: read("spd"), spe: read("spe") };
}

export function normalizeGender(value: string | undefined): PokemonSetData["gender"] {
  if (value === "M" || value === "F" || value === "N") return value;
  return "";
}

/** Full `PokemonSetData` ready for the API: complete EV/IV tables, ≤4 moves, `""` gender when random. */
export function payloadSet(set: PokemonSetData): PokemonSetData {
  return {
    name: set.name.trim().slice(0, NICKNAME_MAX),
    species: set.species.trim(),
    item: set.item.trim(),
    ability: set.ability.trim(),
    moves: set.moves
      .filter((move): move is string => typeof move === "string")
      .map((move) => move.trim())
      .filter(Boolean)
      .slice(0, MOVE_SLOTS),
    nature: set.nature.trim() || "Serious",
    gender: normalizeGender(set.gender),
    evs: statTable(set.evs, EV_MAX, 0),
    ivs: statTable(set.ivs, IV_MAX, 31),
    level: clampInt(set.level, 1, 100),
    shiny: Boolean(set.shiny),
    teraType: set.teraType.trim(),
  };
}

export function payloadSets(slots: ReadonlyArray<PokemonSetData | null>): PokemonSetData[] {
  const sets: PokemonSetData[] = [];
  for (const slot of slots) {
    if (!slot || !slot.species.trim()) continue;
    sets.push(payloadSet(slot));
  }
  return sets;
}

export function evTotal(evs: StatTable): number {
  return STAT_IDS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);
}

/** Raises a stat only while the team still has EV budget. Lowering is always allowed. */
export function withEv(evs: StatTable, stat: StatId, raw: number): StatTable {
  const current = clampInt(evs[stat] ?? 0, 0, EV_MAX);
  const others = STAT_IDS.reduce((sum, id) => sum + (id === stat ? 0 : clampInt(evs[id] ?? 0, 0, EV_MAX)), 0);
  const requested = clampInt(raw, 0, EV_MAX);
  const maxAllowed = Math.max(0, EV_TOTAL - others);
  const value = requested <= current ? requested : Math.min(requested, maxAllowed);
  return { ...evs, [stat]: value };
}

export function spread252(primary: StatId, secondary: StatId, dump: StatId): StatTable | null {
  if (new Set([primary, secondary, dump]).size !== 3) return null;
  const evs: StatTable = { ...ZERO_EVS };
  evs[primary] = 252;
  evs[secondary] = 252;
  evs[dump] = 4;
  return evs;
}

export function padSlots(sets: readonly PokemonSetData[]): Array<PokemonSetData | null> {
  const slots: Array<PokemonSetData | null> = [];
  for (const set of sets.slice(0, SLOT_COUNT)) {
    if (!set.species.trim()) continue;
    slots.push(payloadSet(set));
  }
  while (slots.length < SLOT_COUNT) slots.push(null);
  return slots;
}

export function snapshot(name: string, slots: ReadonlyArray<PokemonSetData | null>): string {
  return JSON.stringify({ name: name.trim(), sets: payloadSets(slots) });
}

export function setFromSpecies(detail: SpeciesDetail, previous: PokemonSetData | null): PokemonSetData {
  return payloadSet({
    name: previous?.name ?? "",
    species: detail.name,
    item: detail.requiredItem ?? "",
    ability: detail.abilities[0] ?? "",
    moves: [],
    nature: previous?.nature || "Serious",
    gender: detail.gender ?? "",
    evs: previous?.evs ?? ZERO_EVS,
    ivs: previous?.ivs ?? PERFECT_IVS,
    level: previous?.level ?? 100,
    shiny: previous?.shiny ?? false,
    teraType: detail.forceTeraType ?? detail.types[0] ?? "",
  });
}

export function moveSlots(moves: readonly string[]): string[] {
  const next = moves.slice(0, MOVE_SLOTS);
  while (next.length < MOVE_SLOTS) next.push("");
  return next;
}

export function writeMove(moves: readonly string[], index: number, name: string): string[] {
  const next = moveSlots(moves);
  const trimmed = name.trim();
  if (trimmed && next.some((move, moveIndex) => moveIndex !== index && move === trimmed)) return [...moves];
  next[index] = trimmed;
  return next.filter(Boolean);
}

export function natureCaption(nature: NatureEntry): string {
  if (!nature.plus || !nature.minus) return `${nature.name} (neutra)`;
  return `${nature.name} (+${STAT_LABEL[nature.plus]} / −${STAT_LABEL[nature.minus]})`;
}

export function findNature(natures: readonly NatureEntry[] | null, name: string): NatureEntry | null {
  if (!natures || !name) return null;
  const id = toSpeciesId(name);
  return natures.find((nature) => nature.name === name || nature.id === id) ?? null;
}

export function natureMod(nature: NatureEntry | null, stat: StatId): number {
  if (!nature || stat === "hp") return 1;
  if (nature.plus === stat) return 1.1;
  if (nature.minus === stat) return 0.9;
  return 1;
}

/** Display-only Showdown stat formula. The server remains the rules authority. */
export function calcStat(stat: StatId, base: number, iv: number, ev: number, level: number, mod: number): number {
  if (stat === "hp") {
    if (base === 1) return 1;
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  const inner = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor(inner * mod);
}

export function calcAllStats(base: StatTable, set: PokemonSetData, nature: NatureEntry | null): StatTable {
  const stats = {} as StatTable;
  for (const stat of STAT_IDS) {
    stats[stat] = calcStat(stat, base[stat], set.ivs[stat], set.evs[stat], set.level, natureMod(nature, stat));
  }
  return stats;
}

export function baseStatTotal(stats: StatTable): number {
  return STAT_IDS.reduce((sum, stat) => sum + stats[stat], 0);
}

export function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function emptyDraft(sets: PokemonSetData[] = [], name = ""): TeamDraft {
  return { id: null, name, formatId: FORMAT_ID, sets };
}

export interface EditorState {
  id: string | null;
  name: string;
  slots: Array<PokemonSetData | null>;
  selected: number;
  baseline: string;
  savedAt: string | null;
}

export type DraftAction =
  | { type: "rename"; name: string }
  | { type: "select"; index: number }
  | { type: "place"; index: number; set: PokemonSetData | null }
  | { type: "patch"; index: number; patch: Partial<PokemonSetData> }
  | { type: "ev"; index: number; stat: StatId; value: number }
  | { type: "iv"; index: number; stat: StatId; value: number }
  | { type: "evs"; index: number; evs: StatTable }
  | { type: "ivs"; index: number; ivs: StatTable }
  | { type: "move"; index: number; moveIndex: number; name: string }
  | { type: "remove"; index: number }
  | { type: "nudge"; index: number; direction: -1 | 1 }
  | { type: "duplicate"; index: number }
  | { type: "replace"; sets: PokemonSetData[] }
  | { type: "saved"; team: TeamRecord };

function inRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
}

function mapSlot(state: EditorState, index: number, mapper: (set: PokemonSetData) => PokemonSetData): EditorState {
  if (!inRange(index)) return state;
  const current = state.slots[index];
  if (!current) return state;
  const slots = state.slots.slice();
  slots[index] = mapper(current);
  return { ...state, slots };
}

export function createEditorState(initial: TeamEditorInitial): EditorState {
  const slots = padSlots(initial.sets);
  return {
    id: initial.id,
    name: initial.name.slice(0, TEAM_NAME_MAX),
    slots,
    selected: 0,
    baseline: snapshot(initial.name, slots),
    savedAt: isTeamRecord(initial) ? initial.updatedAt : null,
  };
}

export function draftReducer(state: EditorState, action: DraftAction): EditorState {
  switch (action.type) {
    case "rename":
      return { ...state, name: action.name.slice(0, TEAM_NAME_MAX) };
    case "select":
      return inRange(action.index) ? { ...state, selected: action.index } : state;
    case "place": {
      if (!inRange(action.index)) return state;
      const slots = state.slots.slice();
      slots[action.index] = action.set ? payloadSet(action.set) : null;
      return { ...state, slots };
    }
    case "patch":
      return mapSlot(state, action.index, (set) => ({
        ...set,
        ...action.patch,
        name: action.patch.name !== undefined ? action.patch.name.slice(0, NICKNAME_MAX) : set.name,
        gender: action.patch.gender !== undefined ? normalizeGender(action.patch.gender) : set.gender,
        level: action.patch.level !== undefined ? clampInt(action.patch.level, 1, 100) : set.level,
        evs: action.patch.evs ? statTable(action.patch.evs, EV_MAX, 0) : set.evs,
        ivs: action.patch.ivs ? statTable(action.patch.ivs, IV_MAX, 31) : set.ivs,
        moves: action.patch.moves
          ? action.patch.moves
              .filter((move): move is string => typeof move === "string")
              .map((move) => move.trim())
              .filter(Boolean)
              .slice(0, MOVE_SLOTS)
          : set.moves,
      }));
    case "ev":
      return mapSlot(state, action.index, (set) => ({ ...set, evs: withEv(set.evs, action.stat, action.value) }));
    case "iv":
      return mapSlot(state, action.index, (set) => ({
        ...set,
        ivs: { ...set.ivs, [action.stat]: clampInt(action.value, 0, IV_MAX) },
      }));
    case "evs":
      return mapSlot(state, action.index, (set) => ({ ...set, evs: statTable(action.evs, EV_MAX, 0) }));
    case "ivs":
      return mapSlot(state, action.index, (set) => ({ ...set, ivs: statTable(action.ivs, IV_MAX, 31) }));
    case "move":
      return mapSlot(state, action.index, (set) => ({ ...set, moves: writeMove(set.moves, action.moveIndex, action.name) }));
    case "remove": {
      if (!inRange(action.index)) return state;
      const slots = state.slots.filter((_, index) => index !== action.index);
      slots.push(null);
      return { ...state, slots, selected: Math.min(action.index, SLOT_COUNT - 1) };
    }
    case "nudge": {
      if (!inRange(action.index)) return state;
      const target = action.index + action.direction;
      if (!inRange(target)) return state;
      const slots = state.slots.slice();
      const current = slots[action.index] ?? null;
      slots[action.index] = slots[target] ?? null;
      slots[target] = current;
      return { ...state, slots, selected: target };
    }
    case "duplicate": {
      if (!inRange(action.index) || !state.slots[action.index]) return state;
      const empty = state.slots.findIndex((slot) => slot === null);
      if (empty < 0) return state;
      const slots = state.slots.slice();
      slots[empty] = payloadSet(state.slots[action.index] as PokemonSetData);
      return { ...state, slots, selected: empty };
    }
    case "replace":
      return { ...state, slots: padSlots(action.sets), selected: 0 };
    case "saved": {
      const slots = padSlots(action.team.sets);
      return {
        ...state,
        id: action.team.id,
        name: action.team.name.slice(0, TEAM_NAME_MAX),
        slots,
        baseline: snapshot(action.team.name, slots),
        savedAt: action.team.updatedAt,
      };
    }
    default:
      return state;
  }
}

export function filledSlotIndexes(slots: ReadonlyArray<PokemonSetData | null>): number[] {
  const indexes: number[] = [];
  slots.forEach((slot, index) => {
    if (slot?.species.trim()) indexes.push(index);
  });
  return indexes;
}

export function problemsForSlot(
  problems: readonly ValidationProblem[],
  slots: ReadonlyArray<PokemonSetData | null>,
  slotIndex: number,
): ValidationProblem[] {
  const setIndex = filledSlotIndexes(slots).indexOf(slotIndex);
  if (setIndex < 0) return [];
  return problems.filter((problem) => problem.setIndex === setIndex);
}

export function teamProblems(problems: readonly ValidationProblem[]): ValidationProblem[] {
  return problems.filter((problem) => problem.setIndex === null);
}

export function readImportedSets(): PokemonSetData[] | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(IMPORTED_SETS_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(IMPORTED_SETS_KEY);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const sets: PokemonSetData[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const set = entry as Partial<PokemonSetData>;
      if (typeof set.species !== "string" || !set.species.trim()) continue;
      sets.push(
        payloadSet({
          name: typeof set.name === "string" ? set.name : "",
          species: set.species,
          item: typeof set.item === "string" ? set.item : "",
          ability: typeof set.ability === "string" ? set.ability : "",
          moves: Array.isArray(set.moves) ? set.moves.filter((move): move is string => typeof move === "string") : [],
          nature: typeof set.nature === "string" ? set.nature : "Serious",
          gender: normalizeGender(typeof set.gender === "string" ? set.gender : ""),
          evs: statTable(set.evs, EV_MAX, 0),
          ivs: statTable(set.ivs, IV_MAX, 31),
          level: typeof set.level === "number" ? set.level : 100,
          shiny: Boolean(set.shiny),
          teraType: typeof set.teraType === "string" ? set.teraType : "",
        }),
      );
    }
    return sets.slice(0, SLOT_COUNT);
  } catch {
    return null;
  }
}
