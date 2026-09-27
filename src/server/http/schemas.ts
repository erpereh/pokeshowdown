import { z } from "zod";
import { ApiException } from "./error.ts";

const stat = (max: number) => z.number().int().min(0).max(max);

const evs = z.object({
  hp: stat(252),
  atk: stat(252),
  def: stat(252),
  spa: stat(252),
  spd: stat(252),
  spe: stat(252),
});

const ivs = z.object({
  hp: stat(31),
  atk: stat(31),
  def: stat(31),
  spa: stat(31),
  spd: stat(31),
  spe: stat(31),
});

export const pokemonSetSchema = z.object({
  name: z.string().max(30),
  species: z.string().min(1).max(50),
  item: z.string().max(50),
  ability: z.string().max(50),
  moves: z.array(z.string().min(1).max(50)).max(4),
  nature: z.string().max(30),
  gender: z.enum(["", "M", "F", "N"]),
  evs,
  ivs,
  level: z.number().int().min(1).max(100),
  shiny: z.boolean(),
  teraType: z.string().max(30),
});

const teamSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("random") }),
  z.object({ kind: z.literal("saved"), teamId: z.uuid() }),
  z.object({ kind: z.literal("inline"), sets: z.array(pokemonSetSchema).max(6) }),
]);

export const createBattleSchema = z.object({
  clientRequestId: z.uuid(),
  formatId: z.enum(["gen9ou", "gen9randombattle"]),
  player: teamSourceSchema,
  cpu: teamSourceSchema,
});

const teamPreviewOrder = z
  .array(z.number().int().min(1).max(6))
  .min(1)
  .max(6)
  .refine((order) => new Set(order).size === order.length && order.every((slot) => slot <= order.length), "El orden debe incluir todos los slots del equipo");

export const playerChoiceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    slot: z.number().int().min(1).max(4),
    terastallize: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("switch"),
    slot: z.number().int().min(1).max(6),
  }),
  z.object({
    kind: z.literal("teamPreview"),
    order: teamPreviewOrder,
  }),
]);

export const submitActionSchema = z.object({
  clientActionId: z.uuid(),
  revision: z.number().int().min(1),
  choice: playerChoiceSchema,
});

export const forfeitSchema = z.object({
  clientActionId: z.uuid(),
  revision: z.number().int().min(1),
});

export const saveTeamSchema = z.object({
  name: z.string().trim().min(1).max(40),
  formatId: z.enum(["gen9ou", "gen9randombattle"]),
  sets: z.array(pokemonSetSchema).max(6),
});

export const validateTeamSchema = z.object({
  formatId: z.enum(["gen9ou", "gen9randombattle"]),
  sets: z.array(pokemonSetSchema).max(24),
});

export const importTeamSchema = z.object({
  text: z.string().max(20_000),
});

export const exportTeamSchema = z.object({
  sets: z.array(pokemonSetSchema).max(24),
});

export const randomTeamSchema = z.object({
  formatId: z.literal("gen9ou"),
});

export const battleStatusSchema = z.enum(["active", "finished"]);

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiException(400, "bad_request", "JSON no válido");
  }
}

export function parseBody<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiException(400, "bad_request", "Solicitud no válida");
  }
  return parsed.data;
}

export function parseUuid(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApiException(400, "bad_request", "Identificador no válido");
  }
  return parsed.data;
}
