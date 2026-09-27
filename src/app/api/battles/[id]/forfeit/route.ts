import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { forfeitSchema, parseBody, parseUuid, readJson } from "@/server/http/schemas";
import { forfeitBattle } from "@/server/persistence/battles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = parseBody(forfeitSchema, await readJson(request));
    const result = await forfeitBattle(user.id, parseUuid(id), body);
    return json(result);
  });
}
