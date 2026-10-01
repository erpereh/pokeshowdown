import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseUuid } from "@/server/http/schemas";
import { removeFriend } from "@/server/persistence/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function DELETE(_request: Request, context: { params: Promise<{ userId: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { userId } = await context.params;
    await removeFriend(user.id, parseUuid(userId));
    return json({ ok: true });
  });
}
