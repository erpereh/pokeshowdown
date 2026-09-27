import { jsonCached, run } from "@/server/http/error";
import { listNatures } from "@/server/teams/dex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => jsonCached({ natures: listNatures() }));
}
