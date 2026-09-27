import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseBody, parseUuid, readJson, saveTeamSchema } from "@/server/http/schemas";
import { deleteTeam, getTeam, updateTeam } from "@/server/persistence/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { supabase, user } = await requireUser();
    const { id } = await context.params;
    return json(await getTeam(supabase, user.id, parseUuid(id)));
  });
}

export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = parseBody(saveTeamSchema, await readJson(request));
    return json(await updateTeam(user.id, parseUuid(id), body));
  });
}

export function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    await deleteTeam(user.id, parseUuid(id));
    return new Response(null, { status: 204 });
  });
}
