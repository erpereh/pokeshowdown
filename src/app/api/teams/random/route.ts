import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseBody, randomTeamSchema, readJson } from "@/server/http/schemas";
import { randomOuTeam } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    await requireUser();
    parseBody(randomTeamSchema, await readJson(request));
    return json({ sets: randomOuTeam() });
  });
}
