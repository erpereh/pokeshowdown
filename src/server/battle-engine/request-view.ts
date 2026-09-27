import "server-only";
import type { FormatId, PlayerRequest, SwitchOption } from "../../shared/contract/index.ts";
import type { ShowdownRequest } from "../cpu/contract.ts";
import { getMoveInfo } from "./dex-cache.ts";
import { nameFromIdent, parseCondition, parseDetails } from "./protocol-text.ts";

export function parseShowdownRequest(raw: string): ShowdownRequest {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Request de Showdown inválida.");
  return value as ShowdownRequest;
}

export function toPlayerRequest(request: ShowdownRequest | null, formatId: FormatId): PlayerRequest | null {
  if (!request) return null;

  const active = request.active?.[0];
  const kind = requestKind(request);
  const moves = (active?.moves ?? []).map((move, index) => {
    const info = getMoveInfo(formatId, move.id || move.move);
    return {
      slot: index + 1,
      id: info.id,
      name: info.name,
      type: info.type,
      category: info.category,
      basePower: info.basePower,
      accuracy: info.accuracy,
      priority: info.priority,
      pp: typeof move.pp === "number" ? move.pp : info.maxPp,
      maxPp: typeof move.maxpp === "number" ? move.maxpp : info.maxPp,
      disabled: Boolean(move.disabled),
      target: move.target || info.target,
      shortDesc: info.shortDesc,
    };
  });

  const switches: SwitchOption[] = request.side.pokemon.map((pokemon, index) => {
    const details = parseDetails(pokemon.details);
    const condition = parseCondition(pokemon.condition);
    const fainted = condition.fainted || condition.hp === 0;
    const reason = fainted ? "fainted" : pokemon.active ? "active" : null;
    return {
      slot: index + 1,
      name: nameFromIdent(pokemon.ident),
      species: details.species,
      disabled: reason !== null,
      reason,
    };
  });

  return {
    rqid: 0,
    kind,
    moves: kind === "move" ? moves : [],
    switches,
    canTerastallize: active?.canTerastallize || null,
    trapped: Boolean(active?.trapped),
    teamPreviewSize: request.teamPreview ? (request.maxChosenTeamSize ?? 6) : 0,
  };
}

function requestKind(request: ShowdownRequest): PlayerRequest["kind"] {
  if (request.wait) return "wait";
  if (request.teamPreview) return "teamPreview";
  if (request.forceSwitch?.some(Boolean)) return "switch";
  if (request.active) return "move";
  return "wait";
}
