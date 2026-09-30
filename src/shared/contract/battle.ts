export const FORMAT_IDS = ["gen9ou", "gen9randombattle"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export type SideId = "p1" | "p2";

export type StatusId = "brn" | "par" | "slp" | "frz" | "psn" | "tox";

export type BoostId = "atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion";

export type MoveCategory = "Physical" | "Special" | "Status";

export type BattleStatus = "active" | "finished";

/** Result always from the player's (p1) point of view. */
export type BattleResult = "win" | "loss" | "tie";

export interface PokemonRef {
  side: SideId;
  /** Nickname as shown by Showdown (`p1a: Name`). */
  name: string;
}

/**
 * Pokémon as visible to the player. For p1 the HP is exact; for p2 `maxHp` is 100
 * and `hp` is a percentage. Hidden data of p2 (item, ability, moves) only appears once revealed.
 */
export interface PokemonView {
  /** 1-based position in the side's team as Showdown orders it. */
  slot: number;
  name: string;
  species: string;
  /**
   * Sprite id: `toID(baseSpecies)` plus `-toID(forme)` when the species has a forme
   * (also for cosmetic formes, unlike `species.spriteid`). Computed server-side.
   */
  spriteId: string;
  level: number;
  gender: "M" | "F" | "N";
  shiny: boolean;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  fainted: boolean;
  active: boolean;
  types: string[];
  teraType: string | null;
  terastallized: string | null;
  item: string | null;
  /** `Dex.items.get(item).spritenum`, index in `itemicons-sheet.png` (16 columns of 24px). */
  itemSpriteNum: number | null;
  ability: string | null;
  /** Move names known to the viewer. */
  moves: string[];
}

export interface ActivePokemonView extends PokemonView {
  boosts: Partial<Record<BoostId, number>>;
  /** Volatile effects currently shown (Substitute, Confusion, Leech Seed, ...). */
  volatiles: string[];
}

export interface SideConditionView {
  id: string;
  name: string;
  layers: number;
}

export interface SideView {
  id: SideId;
  name: string;
  teamSize: number;
  active: ActivePokemonView | null;
  /** p1: full team; p2: only Pokémon revealed so far (team preview or switched in). */
  team: PokemonView[];
  conditions: SideConditionView[];
  canTerastallize: boolean;
}

export interface FieldView {
  weather: string | null;
  terrain: string | null;
  pseudoWeather: string[];
}

export interface PublicBattleState {
  turn: number;
  field: FieldView;
  sides: Record<SideId, SideView>;
}

export interface MoveOption {
  /** 1-based move slot, as Showdown expects in `move N`. */
  slot: number;
  id: string;
  name: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  priority: number;
  pp: number;
  maxPp: number;
  disabled: boolean;
  target: string;
  shortDesc: string;
}

export interface SwitchOption {
  /** 1-based team slot, as Showdown expects in `switch N`. */
  slot: number;
  name: string;
  species: string;
  disabled: boolean;
  /** `notFainted` only while reviving: healthy Pokémon cannot be chosen. */
  reason: "active" | "fainted" | "notFainted" | null;
}

export type RequestKind = "teamPreview" | "move" | "switch" | "wait";

export interface PlayerRequest {
  /** The battle revision this request belongs to (Showdown's simulator has no rqid of its own). */
  rqid: number;
  kind: RequestKind;
  moves: MoveOption[];
  switches: SwitchOption[];
  canTerastallize: string | null;
  trapped: boolean;
  /** True when Showdown requires passing to a fainted Pokémon (Revival Blessing). */
  reviving: boolean;
  /** Team preview only: number of Pokémon to bring (the side's team length, usually 6). */
  teamPreviewSize: number;
}

export type PlayerChoice =
  | { kind: "move"; slot: number; terastallize?: boolean }
  | { kind: "switch"; slot: number }
  | { kind: "teamPreview"; order: number[] };

export type EffectivenessValue = "super" | "resisted" | "immune";

interface EventBase {
  /** Narrative line in Spanish ready for the log. Empty when the event is purely visual. */
  text: string;
}

export type BattleEvent = EventBase &
  (
    | { kind: "turn"; turn: number }
    | { kind: "teamPreview"; side: SideId; species: string[] }
    | {
        kind: "switch";
        cause: "switch" | "drag" | "replace";
        pokemon: PokemonRef;
        species: string;
        spriteId: string;
        level: number;
        gender: "M" | "F" | "N";
        shiny: boolean;
        hp: number;
        maxHp: number;
        status: StatusId | null;
      }
    | {
        kind: "move";
        pokemon: PokemonRef;
        move: string;
        moveType: string;
        category: MoveCategory;
        /** Showdown move flags present (contact, punch, bite, slicing, sound, bullet, ...), for effect selection. */
        flags: string[];
        target: PokemonRef | null;
        missed: boolean;
        failed: boolean;
      }
    | { kind: "formeChange"; pokemon: PokemonRef; species: string; spriteId: string }
    | { kind: "damage" | "heal"; pokemon: PokemonRef; hp: number; maxHp: number; status: StatusId | null; from: string | null }
    | { kind: "faint"; pokemon: PokemonRef }
    | { kind: "status"; pokemon: PokemonRef; status: StatusId }
    | { kind: "cureStatus"; pokemon: PokemonRef; status: StatusId }
    | { kind: "boost"; pokemon: PokemonRef; stat: BoostId; amount: number }
    | { kind: "clearBoosts"; pokemon: PokemonRef | null }
    | { kind: "weather"; weather: string | null; upkeep: boolean }
    | { kind: "fieldStart" | "fieldEnd"; effect: string }
    | { kind: "sideStart" | "sideEnd"; side: SideId; effect: string }
    | { kind: "volatileStart" | "volatileEnd"; pokemon: PokemonRef; effect: string }
    | { kind: "crit"; pokemon: PokemonRef }
    | { kind: "effectiveness"; pokemon: PokemonRef; value: EffectivenessValue }
    | { kind: "terastallize"; pokemon: PokemonRef; teraType: string }
    | { kind: "ability"; pokemon: PokemonRef; ability: string }
    | { kind: "item"; pokemon: PokemonRef; item: string; consumed: boolean }
    | { kind: "message"; pokemon: PokemonRef | null }
    | { kind: "win"; winner: SideId | null }
  );

export type BattleEventKind = BattleEvent["kind"];

/**
 * Output of one engine step (battle start, one resolved choice or a forfeit), from the player's
 * perspective. `state` is the authoritative snapshot after all `events`; clients animate the events
 * and then adopt `state`.
 */
export interface BattleFrame {
  /** 0-based, equals the revision that produced it minus one. */
  index: number;
  events: BattleEvent[];
  state: PublicBattleState;
}

export interface BattleView {
  id: string;
  formatId: FormatId;
  status: BattleStatus;
  result: BattleResult | null;
  endReason: "normal" | "forfeit" | null;
  turn: number;
  /** Monotonic counter; must be echoed back when submitting a choice. Equals `frames.length`. */
  revision: number;
  engineVersion: string;
  /** Background file name inside `gen6bgs`, chosen once per battle. */
  background: string;
  playerName: string;
  cpuName: string;
  /** Snapshot before the first frame (both sides' names and team sizes, nothing on the field). */
  initialState: PublicBattleState;
  frames: BattleFrame[];
  /** Same as the last frame's state (or `initialState` if there are no frames). */
  state: PublicBattleState;
  /** Pending decision for the player; null when finished. */
  request: PlayerRequest | null;
  createdAt: string;
  updatedAt: string;
}

/** First Pokémon each side sent out, taken from the public battle state. */
export interface BattleLead {
  species: string;
  spriteId: string;
}

export interface BattleSummary {
  id: string;
  formatId: FormatId;
  status: BattleStatus;
  result: BattleResult | null;
  endReason: "normal" | "forfeit" | null;
  turn: number;
  playerLead: BattleLead | null;
  cpuLead: BattleLead | null;
  createdAt: string;
  updatedAt: string;
}

/** Read-only copy stored when a battle finishes. */
export type ReplayView = Omit<BattleView, "request" | "status" | "revision"> & { battleId: string };
