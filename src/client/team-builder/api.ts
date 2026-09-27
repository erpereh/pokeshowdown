import { apiFetch, ApiRequestError } from "@/client/api";
import type {
  ExportTeamResponse,
  ImportTeamResponse,
  ListTeamsResponse,
  MoveSummary,
  NamedEntry,
  NatureEntry,
  PokemonSetData,
  RandomTeamResponse,
  SpeciesDetail,
  SpeciesSummary,
  TeamResponse,
  ValidationResult,
} from "@/shared/contract";
import { FORMAT_ID } from "./model";

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
  if (isAbort(error)) return "";
  if (error instanceof ApiRequestError) return error.message;
  return "Ha ocurrido un error inesperado.";
}

export function listTeams() {
  return apiFetch<ListTeamsResponse>("/api/teams");
}

export function getTeam(id: string) {
  return apiFetch<TeamResponse>(`/api/teams/${id}`);
}

export function createTeam(name: string, sets: PokemonSetData[]) {
  return apiFetch<TeamResponse>("/api/teams", {
    method: "POST",
    body: { name, formatId: FORMAT_ID, sets },
  });
}

export function updateTeam(id: string, name: string, sets: PokemonSetData[]) {
  return apiFetch<TeamResponse>(`/api/teams/${id}`, {
    method: "PUT",
    body: { name, formatId: FORMAT_ID, sets },
  });
}

export function deleteTeam(id: string) {
  return apiFetch<null>(`/api/teams/${id}`, { method: "DELETE" });
}

export function duplicateTeam(id: string) {
  return apiFetch<TeamResponse>(`/api/teams/${id}/duplicate`, { method: "POST", body: {} });
}

export function validateTeam(sets: PokemonSetData[], signal?: AbortSignal) {
  return apiFetch<ValidationResult>("/api/teams/validate", {
    method: "POST",
    body: { formatId: FORMAT_ID, sets },
    signal,
  });
}

export function importTeam(text: string) {
  return apiFetch<ImportTeamResponse>("/api/teams/import", { method: "POST", body: { text } });
}

export function exportTeam(sets: PokemonSetData[]) {
  return apiFetch<ExportTeamResponse>("/api/teams/export", { method: "POST", body: { sets } });
}

export function randomTeam() {
  return apiFetch<RandomTeamResponse>("/api/teams/random", { method: "POST", body: { formatId: FORMAT_ID } });
}

export function searchSpecies(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query.trim().slice(0, 40) });
  return apiFetch<{ species: SpeciesSummary[] }>(`/api/dex/species?${params}`, { signal });
}

export function fetchSpecies(id: string, signal?: AbortSignal) {
  return apiFetch<{ species: SpeciesDetail; moves: MoveSummary[] }>(`/api/dex/species/${encodeURIComponent(id)}`, { signal });
}

export async function resolveSpecies(nameOrId: string, signal?: AbortSignal) {
  try {
    return await fetchSpecies(nameOrId.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""), signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!(error instanceof ApiRequestError) || error.status !== 404) throw error;
  }
  const found = await searchSpecies(nameOrId, signal);
  const needle = nameOrId.trim().toLowerCase();
  const compact = needle.replace(/[^a-z0-9]+/g, "");
  const exact =
    found.species.find((species) => species.name.toLowerCase() === needle) ??
    found.species.find((species) => species.id === compact) ??
    found.species.find((species) => species.id.replace(/[^a-z0-9]+/g, "") === compact);
  if (!exact) throw new ApiRequestError(404, null, "Especie no encontrada");
  return fetchSpecies(exact.id, signal);
}

export function searchItems(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query.trim().slice(0, 40) });
  return apiFetch<{ items: NamedEntry[] }>(`/api/dex/items?${params}`, { signal });
}

export function fetchNatures(signal?: AbortSignal) {
  return apiFetch<{ natures: NatureEntry[] }>("/api/dex/natures", { signal });
}

export function fetchTypes(signal?: AbortSignal) {
  return apiFetch<{ types: string[] }>("/api/dex/types", { signal });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
