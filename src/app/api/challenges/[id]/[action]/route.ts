import { requireUser } from "@/server/supabase/require-user";
import { ApiException, json, run } from "@/server/http/error";
import { challengeReadySchema, parseBody, parseUuid, readJson } from "@/server/http/schemas";
import { respondChallenge, setChallengeReady } from "@/server/persistence/challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  return run(async () => {
    const { user } = await requireUser();
    const { id, action } = await context.params;
    const challengeId = parseUuid(id);
    if (action === "ready") {
      const body = parseBody(challengeReadySchema, await readJson(request));
      return json({ challenge: await setChallengeReady(user.id, challengeId, body) });
    }
    if (action !== "accept" && action !== "decline" && action !== "cancel") {
      throw new ApiException(404, "not_found", "Acción no encontrada");
    }
    return json({ challenge: await respondChallenge(user.id, challengeId, action) });
  });
}
