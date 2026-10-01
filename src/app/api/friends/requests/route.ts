import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { friendRequestSchema, parseBody, readJson } from "@/server/http/schemas";
import { sendFriendRequest } from "@/server/persistence/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    const { user } = await requireUser();
    const body = parseBody(friendRequestSchema, await readJson(request));
    return json(await sendFriendRequest(user.id, body.code));
  });
}
