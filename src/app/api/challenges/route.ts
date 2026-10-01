import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { createChallengeSchema, parseBody, readJson } from "@/server/http/schemas";
import { createChallenge } from "@/server/persistence/challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    const { user } = await requireUser();
    const body = parseBody(createChallengeSchema, await readJson(request));
    return json({ challenge: await createChallenge(user.id, body) }, 201);
  });
}
