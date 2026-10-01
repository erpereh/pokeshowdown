import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { getFriendsOverview } from "@/server/persistence/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => {
    const { user } = await requireUser();
    return json(await getFriendsOverview(user.id));
  });
}
