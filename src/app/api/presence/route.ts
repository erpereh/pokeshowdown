import { requireUser } from "@/server/supabase/require-user";
import { json, run } from "@/server/http/error";
import { heartbeat } from "@/server/persistence/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST() {
  return run(async () => {
    const { user } = await requireUser();
    await heartbeat(user.id);
    return json({ ok: true });
  });
}
