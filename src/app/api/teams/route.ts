import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseBody, readJson, saveTeamSchema } from "@/server/http/schemas";
import { createTeam, listTeams } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => {
    const { supabase, user } = await requireUser();
    const teams = await listTeams(supabase, user.id);
    return json({ teams });
  });
}

export function POST(request: Request) {
  return run(async () => {
    const { user } = await requireUser();
    const body = parseBody(saveTeamSchema, await readJson(request));
    const result = await createTeam(user.id, body);
    return json(result, 201);
  });
}
