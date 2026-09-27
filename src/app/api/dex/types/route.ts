import { jsonCached, run } from "@/server/http/error";
import { listTypes } from "@/server/teams/dex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => jsonCached({ types: listTypes().map((type) => type.name) }));
}
