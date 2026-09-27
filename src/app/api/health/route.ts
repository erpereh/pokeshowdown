import { ENGINE_VERSION, getDex } from "@/server/showdown";

export const runtime = "nodejs";

export function GET() {
  const format = getDex().formats.get("gen9ou");
  return Response.json({
    engineVersion: ENGINE_VERSION,
    gen9ou: format.exists,
  });
}
