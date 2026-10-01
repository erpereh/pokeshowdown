import type { FormatId } from "./battle.ts";
import type { PokemonSetData } from "./team.ts";

/** Friends and online challenges. Only display names and friend codes are shared; never emails. */

export type ChallengeTimer = 60 | 120 | null;
export type OuTeamSource = "saved" | "saved_or_random";
export type InviteTtlMinutes = 2 | 5 | 10;

export const CHALLENGE_TIMERS: readonly ChallengeTimer[] = [null, 60, 120];
export const INVITE_TTLS: readonly InviteTtlMinutes[] = [2, 5, 10];
export const DEFAULT_INVITE_TTL: InviteTtlMinutes = 5;

/** Fixed by the challenger when sending; immutable afterwards. */
export interface ChallengeConfig {
  formatId: FormatId;
  timerSeconds: ChallengeTimer;
  /** Only meaningful for gen9ou. */
  ouTeamSource: OuTeamSource;
  inviteTtlMinutes: InviteTtlMinutes;
}

export type ChallengeStatus = "pending" | "preparing" | "started" | "declined" | "cancelled" | "expired";

export interface PublicPlayer {
  userId: string;
  displayName: string;
  friendCode: string;
}

export interface ChallengeView {
  id: string;
  status: ChallengeStatus;
  config: ChallengeConfig;
  role: "challenger" | "challenged";
  opponent: PublicPlayer & { online: boolean; ready: boolean };
  me: {
    ready: boolean;
    /** Own team picked for this challenge (never the rival's). Null until ready or in Random Battle. */
    team: PokemonSetData[] | null;
  };
  /** Invitation deadline (pending). */
  expiresAt: string;
  /** Team preparation deadline (preparing). */
  prepareExpiresAt: string | null;
  /** The viewer's battle (seat) once started. */
  battleId: string | null;
  serverNow: string;
  createdAt: string;
}

export interface FriendEntry extends PublicPlayer {
  online: boolean;
  lastSeenAt: string | null;
  since: string;
  /** Open challenge (pending/preparing) between both, if any. */
  challengeId: string | null;
  /** The viewer's seat of an active online battle against this friend, if any. */
  activeBattleId: string | null;
}

export interface FriendRequestEntry {
  id: string;
  user: PublicPlayer;
  createdAt: string;
}

export interface FriendsOverview {
  me: PublicPlayer;
  friends: FriendEntry[];
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
  /** Open challenges involving the viewer. */
  challenges: ChallengeView[];
  serverNow: string;
}

/* GET /api/friends -> FriendsOverview */

/* POST /api/friends/requests */
export interface SendFriendRequestBody {
  code: string;
}
export interface SendFriendRequestResponse {
  status: "sent" | "accepted";
}

/* POST /api/friends/requests/[id]/(accept|decline|cancel), DELETE /api/friends/[userId] -> { ok: true } */

/* POST /api/challenges */
export interface CreateChallengeBody extends ChallengeConfig {
  clientRequestId: string;
  opponentId: string;
}

/* GET /api/challenges/[id], POST /api/challenges/[id]/(accept|decline|cancel) -> { challenge } */
export interface ChallengeResponse {
  challenge: ChallengeView;
}

/* POST /api/challenges/[id]/ready */
export type ChallengeTeamPick = { kind: "saved"; teamId: string } | { kind: "random" };
export interface ChallengeReadyBody {
  ready: boolean;
  /** Required for gen9ou when ready; ignored in Random Battle. */
  team?: ChallengeTeamPick;
}
