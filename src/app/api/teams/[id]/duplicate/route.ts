import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseUuid } from "@/server/http/schemas";
import { duplicateTeam } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    return json(await duplicateTeam(user.id, parseUuid(id)), 201);
  });
}
