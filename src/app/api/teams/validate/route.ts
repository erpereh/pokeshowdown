import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseBody, readJson, validateTeamSchema } from "@/server/http/schemas";
import { validateTeamBody } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    await requireUser();
    const body = parseBody(validateTeamSchema, await readJson(request));
    return json(validateTeamBody(body.formatId, body.sets));
  });
}
