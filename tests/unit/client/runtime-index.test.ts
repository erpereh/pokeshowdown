import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("retries a failed asset-index load and caches only the recovered index", async () => {
  const payload = {
    v: 1,
    engine: "0.11.11",
    base: "/assets/generated",
    sprites: { pikachu: [1, 60, 60, 60, 60] },
  };
  const fetchIndex = vi.fn()
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(Response.json(payload));
  vi.stubGlobal("fetch", fetchIndex);
  const { loadRuntimeIndex } = await import("@/client/sprites/runtime-index");
  expect((await loadRuntimeIndex()).sprites).toEqual({});
  const recovered = await loadRuntimeIndex();
  expect(recovered.engine).toBe("0.11.11");
  expect(recovered.sprites.pikachu).toEqual([1, 60, 60, 60, 60]);
  expect(await loadRuntimeIndex()).toBe(recovered);
  expect(fetchIndex).toHaveBeenCalledTimes(2);
});
