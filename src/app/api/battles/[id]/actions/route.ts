import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseBody, parseUuid, readJson, submitActionSchema } from "@/server/http/schemas";
import { submitAction } from "@/server/persistence/battles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = parseBody(submitActionSchema, await readJson(request));
    const result = await submitAction(user.id, parseUuid(id), body);
    return json(result);
  });
}
