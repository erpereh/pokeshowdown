import type {
  BattleFrame,
  BattleResult,
  BattleStatus,
  BattleSummary,
  BattleView,
  FormatId,
  PlayerRequest,
  PublicBattleState,
  ReplayView,
  SideView,
} from "../../shared/contract/index.ts";
import type { Database } from "../supabase/database.types.ts";

type BattleRow = Database["public"]["Tables"]["battles"]["Row"];
type ReplayRow = Database["public"]["Tables"]["battle_replays"]["Row"];

export function resultFromWinner(winner: string | null): BattleResult | null {
  if (winner === "p1") return "win";
  if (winner === "p2") return "loss";
  if (winner === "tie") return "tie";
  return null;
}

export function emptyBattleState(playerName: string, cpuName: string): PublicBattleState {
  const side = (id: "p1" | "p2", name: string): SideView => ({
    id,
    name,
    teamSize: 6,
    active: null,
    team: [],
    conditions: [],
    canTerastallize: false,
  });
  return {
    turn: 0,
    field: { weather: null, terrain: null, pseudoWeather: [] },
    sides: { p1: side("p1", playerName), p2: side("p2", cpuName) },
  };
}

function toIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function asFrames(value: unknown): BattleFrame[] {
  return Array.isArray(value) ? (value as BattleFrame[]) : [];
}

function withRqid(request: PlayerRequest | null, revision: number): PlayerRequest | null {
  if (!request) return null;
  return { ...request, rqid: revision };
}

export function toBattleView(row: BattleRow): BattleView {
  const frames = asFrames(row.frames);
  const initialState = row.initial_state as unknown as PublicBattleState;
  const state = frames.at(-1)?.state ?? initialState;
  return {
    id: row.id,
    formatId: row.format_id as FormatId,
    status: row.status as BattleStatus,
    result: resultFromWinner(row.winner),
    endReason: (row.end_reason as BattleView["endReason"]) ?? null,
    turn: row.turn,
    revision: row.revision,
    engineVersion: row.engine_version,
    background: row.background,
    playerName: row.player_name,
    cpuName: row.cpu_name,
    initialState,
    frames,
    state,
    request: row.status === "finished" ? null : withRqid((row.p1_request as PlayerRequest | null) ?? null, row.revision),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

type BattleListRow = Pick<
  BattleRow,
  "id" | "format_id" | "status" | "winner" | "end_reason" | "turn" | "created_at" | "updated_at"
>;

export function toBattleSummary(row: BattleListRow): BattleSummary {
  return {
    id: row.id,
    formatId: row.format_id as FormatId,
    status: row.status as BattleStatus,
    result: resultFromWinner(row.winner),
    endReason: (row.end_reason as BattleSummary["endReason"]) ?? null,
    turn: row.turn,
    playerLead: null,
    cpuLead: null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function frameAt(view: BattleView, index: number): BattleFrame | null {
  return view.frames.find((frame) => frame.index === index) ?? view.frames[index] ?? null;
}

export function toReplayView(row: ReplayRow): ReplayView {
  const stored = (row.replay ?? {}) as Partial<ReplayView>;
  const frames = asFrames(stored.frames);
  const initialState = (stored.initialState ?? emptyBattleState(stored.playerName ?? "Player", stored.cpuName ?? "CPU")) as PublicBattleState;
  return {
    id: row.battle_id,
    battleId: row.battle_id,
    formatId: row.format_id as FormatId,
    result: row.result as BattleResult,
    endReason: stored.endReason ?? null,
    turn: row.turns,
    engineVersion: row.engine_version,
    background: stored.background ?? "",
    playerName: stored.playerName ?? "",
    cpuName: stored.cpuName ?? "CPU",
    initialState,
    frames,
    state: stored.state ?? frames.at(-1)?.state ?? initialState,
    createdAt: toIso(typeof stored.createdAt === "string" ? stored.createdAt : row.created_at),
    updatedAt: toIso(typeof stored.updatedAt === "string" ? stored.updatedAt : row.created_at),
  };
}
