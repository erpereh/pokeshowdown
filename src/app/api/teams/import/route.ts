import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { importTeamSchema, parseBody, readJson } from "@/server/http/schemas";
import { importTeamText } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    await requireUser();
    const body = parseBody(importTeamSchema, await readJson(request));
    return json({ sets: importTeamText(body.text) });
  });
}
