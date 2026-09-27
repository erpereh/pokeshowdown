import type { ApiError, BattleView } from "../../shared/contract/index.ts";

export class ApiException extends Error {
  readonly status: number;
  readonly code: ApiError["error"]["code"];
  readonly view?: BattleView;

  constructor(status: number, code: ApiError["error"]["code"], message: string, view?: BattleView) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.code = code;
    this.view = view;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiException) {
    const body: ApiError = { error: { code: error.code, message: error.message } };
    if (error.view) body.view = error.view;
    return Response.json(body, { status: error.status });
  }

  const detail = error instanceof Error ? error.message : "unknown";
  console.error("[api] internal", detail);
  return Response.json(
    { error: { code: "internal", message: "Error interno" } } satisfies ApiError,
    { status: 500 },
  );
}

export function run(work: () => Promise<Response>): Promise<Response> {
  return work().catch((error: unknown) => toErrorResponse(error));
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function jsonCached(body: unknown): Response {
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
