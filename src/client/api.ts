import type { ApiError } from "@/shared/contract";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiError | null;

  constructor(status: number, body: ApiError | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.status = status;
    this.body = body;
  }

  get code() {
    return this.body?.error.code ?? (this.status === 0 ? "network" : "internal");
  }
}

/**
 * Typed JSON fetch against our Route Handlers. Throws ApiRequestError with the server's ApiError
 * (status 0 when the network failed).
 */
export async function apiFetch<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiRequestError(0, null, "No se pudo conectar con el servidor. Comprueba tu conexión.");
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new ApiRequestError(response.status, (json as ApiError | null) ?? null, `Error ${response.status}`);
  }
  return json as T;
}

export function newClientId() {
  return crypto.randomUUID();
}
