import "server-only";
import type {
  PokemonSetData,
  SaveTeamBody,
  TeamRecord,
  TeamSummary,
  ValidationResult,
} from "../../shared/contract/index.ts";
import { ENGINE_VERSION } from "../showdown/index.ts";
import { toID } from "../showdown/module.ts";
import { getSpeciesDetail } from "../teams/dex.ts";
import { exportTeam, importTeam, normalizeSet, packTeam, unpackTeam } from "../teams/format.ts";
import { generateRandomOuTeam } from "../teams/random-ou.ts";
import { validateTeam } from "../teams/validation.ts";
import { ApiException } from "../http/error.ts";
import { createAdminSupabase, type DbClient } from "../supabase/admin.ts";
import type { Database } from "../supabase/database.types.ts";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];

function assertSavedFormat(formatId: SaveTeamBody["formatId"]): "gen9ou" {
  if (formatId !== "gen9ou") {
    throw new ApiException(400, "bad_request", "Los equipos guardados son de gen9ou");
  }
  return formatId;
}

function leadTypeFor(species: string): string | null {
  try {
    return getSpeciesDetail(toID(species)).species.types[0] ?? null;
  } catch {
    return null;
  }
}

function spriteIdFor(species: string): string {
  try {
    return getSpeciesDetail(toID(species)).species.spriteId;
  } catch {
    return toID(species);
  }
}

function toRecord(row: TeamRow, sets: PokemonSetData[]): TeamRecord {
  return {
    id: row.id,
    name: row.name,
    formatId: "gen9ou",
    sets,
    valid: row.valid,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function unpackStored(packed: string): PokemonSetData[] {
  try {
    return unpackTeam(packed).map((set) => normalizeSet(set));
  } catch (error) {
    console.error("[teams] unpack", error instanceof Error ? error.message : "unknown");
    throw new ApiException(500, "internal", "Error interno");
  }
}

async function loadOwned(db: DbClient, userId: string, teamId: string): Promise<TeamRow> {
  const { data, error } = await db.from("teams").select("*").eq("id", teamId).eq("owner_id", userId).maybeSingle();
  if (error) {
    console.error("[teams] load", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!data) throw new ApiException(404, "not_found", "Equipo no encontrado");
  return data;
}

export async function listTeams(db: DbClient, userId: string): Promise<TeamSummary[]> {
  const { data, error } = await db
    .from("teams")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[teams] list", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  return (data ?? []).map((row) => {
    const sets = unpackStored(row.packed_team);
    return {
      id: row.id,
      name: row.name,
      formatId: "gen9ou",
      species: sets.map((set) => set.species),
      spriteIds: sets.map((set) => spriteIdFor(set.species)),
      leadType: sets[0] ? leadTypeFor(sets[0].species) : null,
      valid: row.valid,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
}

export async function getTeam(db: DbClient, userId: string, teamId: string): Promise<{ team: TeamRecord; validation: ValidationResult }> {
  const row = await loadOwned(db, userId, teamId);
  const sets = unpackStored(row.packed_team);
  return { team: toRecord(row, sets), validation: validateTeam("gen9ou", sets) };
}

export async function createTeam(
  userId: string,
  body: SaveTeamBody,
): Promise<{ team: TeamRecord; validation: ValidationResult }> {
  const formatId = assertSavedFormat(body.formatId);
  const sets = body.sets.map((set) => normalizeSet(set));
  const validation = validateTeam(formatId, sets);
  const packed = packTeam(sets);
  assertPackedSize(packed);
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("teams")
    .insert({
      owner_id: userId,
      name: body.name,
      format_id: formatId,
      packed_team: packed,
      valid: validation.valid,
      engine_version: ENGINE_VERSION,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[teams] create", error?.code ?? "empty");
    throw new ApiException(500, "internal", "Error interno");
  }
  return { team: toRecord(data, sets), validation };
}

export async function updateTeam(
  userId: string,
  teamId: string,
  body: SaveTeamBody,
): Promise<{ team: TeamRecord; validation: ValidationResult }> {
  const formatId = assertSavedFormat(body.formatId);
  const db = createAdminSupabase();
  await loadOwned(db, userId, teamId);
  const sets = body.sets.map((set) => normalizeSet(set));
  const validation = validateTeam(formatId, sets);
  const packed = packTeam(sets);
  assertPackedSize(packed);
  const { data, error } = await db
    .from("teams")
    .update({
      name: body.name,
      format_id: formatId,
      packed_team: packed,
      valid: validation.valid,
      engine_version: ENGINE_VERSION,
    })
    .eq("id", teamId)
    .eq("owner_id", userId)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[teams] update", error?.code ?? "empty");
    throw new ApiException(500, "internal", "Error interno");
  }
  return { team: toRecord(data, sets), validation };
}

export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  const db = createAdminSupabase();
  const { data, error } = await db.from("teams").delete().eq("id", teamId).eq("owner_id", userId).select("id");
  if (error) {
    console.error("[teams] delete", error.code);
    throw new ApiException(500, "internal", "Error interno");
  }
  if (!data || data.length === 0) throw new ApiException(404, "not_found", "Equipo no encontrado");
}

export async function duplicateTeam(
  userId: string,
  teamId: string,
): Promise<{ team: TeamRecord; validation: ValidationResult }> {
  const db = createAdminSupabase();
  const row = await loadOwned(db, userId, teamId);
  const sets = unpackStored(row.packed_team);
  const name = copyName(row.name);
  const validation = validateTeam("gen9ou", sets);
  const packed = packTeam(sets);
  assertPackedSize(packed);
  const { data, error } = await db
    .from("teams")
    .insert({
      owner_id: userId,
      name,
      format_id: "gen9ou",
      packed_team: packed,
      valid: validation.valid,
      engine_version: ENGINE_VERSION,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[teams] duplicate", error?.code ?? "empty");
    throw new ApiException(500, "internal", "Error interno");
  }
  return { team: toRecord(data, sets), validation };
}

function assertPackedSize(packed: string): void {
  if (Buffer.byteLength(packed) > 8192) {
    throw new ApiException(400, "bad_request", "El equipo empaquetado es demasiado grande");
  }
}

function copyName(name: string): string {
  const next = `Copia de ${name}`;
  return next.length <= 40 ? next : next.slice(0, 40);
}

export function validateTeamBody(formatId: "gen9ou" | "gen9randombattle", sets: PokemonSetData[]): ValidationResult {
  const normalized = sets.map((set) => normalizeSet(set));
  return validateTeam(formatId, normalized);
}

export function importTeamText(text: string): PokemonSetData[] {
  try {
    return importTeam(text).map((set) => normalizeSet(set));
  } catch {
    throw new ApiException(400, "bad_request", "No se ha podido importar el equipo");
  }
}

export function exportTeamText(sets: PokemonSetData[]): string {
  try {
    return exportTeam(sets.map((set) => normalizeSet(set)));
  } catch {
    throw new ApiException(400, "bad_request", "No se ha podido exportar el equipo");
  }
}

export function randomOuTeam(): PokemonSetData[] {
  return generateRandomOuTeam().map((set) => normalizeSet(set));
}
