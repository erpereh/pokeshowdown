import { requireUser } from "@/server/supabase/require-user";
import { ApiException, json, run } from "@/server/http/error";
import { parseUuid } from "@/server/http/schemas";
import { respondFriendRequest } from "@/server/persistence/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["accept", "decline", "cancel"] as const;

export function POST(_request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id, action } = await context.params;
    const verb = ACTIONS.find((entry) => entry === action);
    if (!verb) throw new ApiException(404, "not_found", "Acción no encontrada");
    await respondFriendRequest(user.id, parseUuid(id), verb);
    return json({ ok: true });
  });
}
