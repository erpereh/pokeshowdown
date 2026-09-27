import { requireUser } from "@/server/supabase/require-user";
import { ApiException, json, run } from "@/server/http/error";
import { battleStatusSchema, createBattleSchema, parseBody, readJson } from "@/server/http/schemas";
import { createBattle, listBattles } from "@/server/persistence/battles";
import type { BattleStatus } from "@/shared/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => {
    const { user } = await requireUser();
    const statusParam = new URL(request.url).searchParams.get("status");
    let status: BattleStatus | undefined;
    if (statusParam !== null) {
      const parsed = battleStatusSchema.safeParse(statusParam);
      if (!parsed.success) throw new ApiException(400, "bad_request", "Solicitud no válida");
      status = parsed.data;
    }
    const battles = await listBattles(user.id, status);
    return json({ battles });
  });
}

export function POST(request: Request) {
  return run(async () => {
    const { user } = await requireUser();
    const body = parseBody(createBattleSchema, await readJson(request));
    const view = await createBattle(user.id, body);
    return json({ view }, 201);
  });
}
