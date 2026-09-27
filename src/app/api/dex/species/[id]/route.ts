import { ApiException, jsonCached, run } from "@/server/http/error";
import { getSpeciesDetail } from "@/server/teams/dex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await context.params;
    const speciesId = decodeURIComponent(id).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(speciesId) || speciesId.length > 50) {
      throw new ApiException(404, "not_found", "Especie no encontrada");
    }
    try {
      const detail = getSpeciesDetail(speciesId);
      return jsonCached({ species: detail.species, moves: detail.moves });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unknown species")) {
        throw new ApiException(404, "not_found", "Especie no encontrada");
      }
      throw error;
    }
  });
}
