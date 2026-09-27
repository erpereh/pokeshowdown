import { ApiException, jsonCached, run } from "@/server/http/error";
import { searchAbilities } from "@/server/teams/dex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.length > 40) throw new ApiException(400, "bad_request", "Solicitud no válida");
    return jsonCached({ abilities: searchAbilities(q) });
  });
}
