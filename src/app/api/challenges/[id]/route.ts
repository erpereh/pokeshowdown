import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { parseUuid } from "@/server/http/schemas";
import { getChallenge } from "@/server/persistence/challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id } = await context.params;
    return json({ challenge: await getChallenge(user.id, parseUuid(id)) });
  });
}
