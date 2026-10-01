import type { BattleFrame, BattleSummary, BattleView, FormatId, PlayerChoice, ReplayView } from "./battle.ts";
import type { PokemonSetData, TeamRecord, TeamSummary, ValidationResult } from "./team.ts";

/**
 * HTTP contract of the Route Handlers. All bodies are JSON. Errors always use `ApiError`
 * with an HTTP status: 400 malformed, 401 no session, 404 not found or not owned,
 * 409 stale revision / finished battle / engine version mismatch, 422 illegal choice or invalid team.
 */
export interface ApiError {
  error: {
    code:
      | "bad_request"
      | "unauthorized"
      | "not_found"
      | "stale_revision"
      | "battle_finished"
      | "invalid_choice"
      | "invalid_team"
      | "engine_version_mismatch"
      | "conflict"
      | "expired"
      | "internal";
    message: string;
  };
  /** Present when a challenge already exists between both players (409 conflict). */
  challengeId?: string;
  /** Present on 409 so the client can resync without another request. */
  view?: BattleView;
}

export type TeamSource = { kind: "random" } | { kind: "saved"; teamId: string } | { kind: "inline"; sets: PokemonSetData[] };

/* POST /api/battles */
export interface CreateBattleBody {
  /** Client-generated UUID; resubmitting returns the battle already created with it. */
  clientRequestId: string;
  formatId: FormatId;
  /** Ignored for gen9randombattle (the official generator builds both teams). */
  player: TeamSource;
  cpu: TeamSource;
}
export interface CreateBattleResponse {
  view: BattleView;
}

/* GET /api/battles?status=active|finished */
export interface ListBattlesResponse {
  battles: BattleSummary[];
}

/* GET /api/battles/[id] */
export interface GetBattleResponse {
  view: BattleView;
}

/* POST /api/battles/[id]/actions */
export interface SubmitActionBody {
  /** Client-generated UUID; resubmitting the same id returns the stored outcome. */
  clientActionId: string;
  /** Must equal the battle revision the request was issued for (`request.rqid`). */
  revision: number;
  choice: PlayerChoice;
}
/* POST /api/battles/[id]/forfeit */
export interface ForfeitBody {
  clientActionId: string;
  revision: number;
}
export interface ActionResponse {
  view: BattleView;
  /** Frames produced by this action (usually one), for animation. */
  newFrames: BattleFrame[];
  /** True when this response replays an already persisted outcome. */
  replayed: boolean;
}

/* GET /api/replays/[battleId] */
export interface GetReplayResponse {
  replay: ReplayView;
}

/* Teams: GET/POST /api/teams, GET/PUT/DELETE /api/teams/[id], POST /api/teams/[id]/duplicate */
export interface ListTeamsResponse {
  teams: TeamSummary[];
}
export interface SaveTeamBody {
  name: string;
  formatId: FormatId;
  sets: PokemonSetData[];
}
export interface TeamResponse {
  team: TeamRecord;
  validation: ValidationResult;
}

/* POST /api/teams/validate */
export interface ValidateTeamBody {
  formatId: FormatId;
  sets: PokemonSetData[];
}
/* POST /api/teams/import  ->  { sets } ; POST /api/teams/export -> { text } */
export interface ImportTeamBody {
  text: string;
}
export interface ImportTeamResponse {
  sets: PokemonSetData[];
}
export interface ExportTeamBody {
  sets: PokemonSetData[];
}
export interface ExportTeamResponse {
  text: string;
}
/* POST /api/teams/random { formatId: "gen9ou" } -> random legal OU team, not saved */
export interface RandomTeamResponse {
  sets: PokemonSetData[];
}

/*
 * Dex (public, cached):
 * GET /api/dex/species?q=           -> { species: SpeciesSummary[] }   (gen9 OU-relevant, non-nonstandard)
 * GET /api/dex/species/[id]         -> { species: SpeciesDetail, moves: MoveSummary[] }  (learnable in gen9)
 * GET /api/dex/items?q=             -> { items: NamedEntry[] }
 * GET /api/dex/abilities?q=         -> { abilities: NamedEntry[] }
 * GET /api/dex/natures              -> { natures: NatureEntry[] }
 * GET /api/dex/types                -> { types: string[] }
 */
