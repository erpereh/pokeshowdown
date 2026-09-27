import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { exportTeamSchema, parseBody, readJson } from "@/server/http/schemas";
import { exportTeamText } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    await requireUser();
    const body = parseBody(exportTeamSchema, await readJson(request));
    return json({ text: exportTeamText(body.sets) });
  });
}
