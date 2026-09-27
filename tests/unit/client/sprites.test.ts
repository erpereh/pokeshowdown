import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backgroundUrl,
  emptyRuntimeIndex,
  fxUrl,
  itemSpriteStyle,
  normalizeRuntimeIndex,
  preloadSprites,
  resolveSpriteUrls,
  teraIconUrl,
  typeIconUrl,
  type RuntimeIndex,
} from "@/client/sprites/runtime-index";
import {
  hazardParticle,
  moveFxPlan,
  pseudoOverlayFile,
  terrainOverlayFile,
  toAssetId,
  weatherOverlayFile,
} from "@/client/battle/fx/catalog";

const bits = ["ani", "ani-back", "gen5", "gen5-back", "gen5-shiny", "gen5-back-shiny", "ani-shiny", "ani-back-shiny"];

function mask(...names: string[]) {
  return names.reduce((acc, name) => acc | (1 << bits.indexOf(name)), 0);
}

function index(overrides: Partial<RuntimeIndex> = {}): RuntimeIndex {
  return {
    v: 1,
    engine: "test",
    base: "/assets/generated",
    bits,
    sprites: {
      pikachu: [mask("ani", "ani-back", "gen5", "gen5-back", "gen5-shiny", "gen5-back-shiny", "ani-shiny", "ani-back-shiny"), 60, 60, 65, 61],
      "pikachu-f": [mask("ani", "gen5", "gen5-shiny", "ani-shiny"), 48, 52, 0, 0],
      "gastrodon-east": [mask("ani", "ani-back", "gen5", "gen5-back"), 62, 77, 66, 75],
      gastrodon: [mask("gen5", "gen5-back"), 63, 77, 68, 74],
      ironvaliant: [mask("gen5", "gen5-back", "gen5-shiny", "gen5-back-shiny"), 96, 96, 96, 96],
      greninja: [mask("ani", "ani-back", "gen5", "gen5-back"), 131, 76, 123, 73],
      frontonly: [mask("ani", "gen5"), 40, 50, 0, 0],
    },
    backgrounds: ["bg-beach.jpg"],
    fx: ["impact.png", "shine.png", "pokeball.png", "weather-raindance.jpg"],
    types: ["Fire.png", "TeraFire.png", "Water.png"],
    ...overrides,
  };
}

const url = (folder: string, file: string) => `/assets/generated/sprites/${folder}/${file}`;

describe("resolveSpriteUrls", () => {
  it("orders shiny animated front as ani-shiny, gen5-shiny, ani, gen5", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", facing: "front", shiny: true });
    expect(resolved.urls).toEqual([
      url("ani-shiny", "pikachu.gif"),
      url("gen5-shiny", "pikachu.png"),
      url("ani", "pikachu.gif"),
      url("gen5", "pikachu.png"),
    ]);
    expect(resolved).toMatchObject({ width: 60, height: 60 });
  });

  it("skips shiny folders when the Pokémon is not shiny", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", facing: "front" });
    expect(resolved.urls).toEqual([url("ani", "pikachu.gif"), url("gen5", "pikachu.png")]);
  });

  it("uses back folders and back dimensions", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", facing: "back", shiny: true, animated: false });
    expect(resolved.urls).toEqual([url("gen5-back-shiny", "pikachu.png"), url("gen5-back", "pikachu.png")]);
    expect(resolved).toMatchObject({ width: 65, height: 61 });
  });

  it("tries the female -f id before the base species", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", facing: "front", gender: "F", animated: false });
    expect(resolved.urls).toEqual([
      url("gen5", "pikachu-f.png"),
      url("gen5", "pikachu.png"),
    ]);
    expect(resolved).toMatchObject({ width: 48, height: 52 });
  });

  it("ignores -f unless gender is F", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", facing: "front", gender: "M", animated: false });
    expect(resolved.urls).toEqual([url("gen5", "pikachu.png")]);
  });

  it("falls back to the id before the first hyphen when the forme is missing", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "greninja-bond", facing: "front" });
    expect(resolved.urls).toEqual([url("ani", "greninja.gif"), url("gen5", "greninja.png")]);
    expect(resolved).toMatchObject({ width: 131, height: 76 });
  });

  it("appends the base species after a cosmetic forme", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "gastrodon-east", facing: "front", animated: false });
    expect(resolved.urls).toEqual([url("gen5", "gastrodon-east.png"), url("gen5", "gastrodon.png")]);
    expect(resolved).toMatchObject({ width: 62, height: 77 });
  });

  it("does not invent animated urls when only gen5 bits are set", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "ironvaliant", facing: "front", shiny: true });
    expect(resolved.urls).toEqual([url("gen5-shiny", "ironvaliant.png"), url("gen5", "ironvaliant.png")]);
  });

  it("reads bits in index order", () => {
    const custom = index({
      bits: ["gen5", "ani"],
      sprites: { abra: [1, 10, 20, 0, 0] },
    });
    const resolved = resolveSpriteUrls(custom, { spriteId: "abra", facing: "front" });
    expect(resolved.urls).toEqual([url("gen5", "abra.png")]);
    expect(resolved).toMatchObject({ width: 10, height: 20 });
  });

  it("uses front dimensions when the facing has no art", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "frontonly", facing: "back" });
    expect(resolved.urls).toEqual([]);
    expect(resolved).toMatchObject({ width: 40, height: 50 });
  });

  it("defaults a missing facing to the front sprite", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "pikachu", animated: false });
    expect(resolved.urls).toEqual([url("gen5", "pikachu.png")]);
  });

  it("returns a 96px box when the id is unknown", () => {
    const resolved = resolveSpriteUrls(index(), { spriteId: "missingno", facing: "front", shiny: true });
    expect(resolved).toEqual({ urls: [], width: 96, height: 96 });
  });

  it("honors a custom base path", () => {
    const resolved = resolveSpriteUrls(index({ base: "/cdn" }), { spriteId: "pikachu", facing: "front", animated: false });
    expect(resolved.urls).toEqual(["/cdn/sprites/gen5/pikachu.png"]);
  });
});

describe("asset urls", () => {
  const assets = index();

  it("resolves backgrounds and fx only when the index lists them", () => {
    expect(backgroundUrl(assets, "bg-beach.jpg")).toBe("/assets/generated/sprites/gen6bgs/bg-beach.jpg");
    expect(backgroundUrl("bg-beach.jpg")).toBe("/assets/generated/sprites/gen6bgs/bg-beach.jpg");
    expect(backgroundUrl(assets, "bg-missing.jpg")).toBeNull();
    expect(backgroundUrl(assets, "../secret.png")).toBeNull();
    expect(fxUrl(assets, "impact")).toBe("/assets/generated/fx/impact.png");
    expect(fxUrl(assets, "IMPACT.PNG")).toBe("/assets/generated/fx/impact.png");
    expect(fxUrl(assets, "ring")).toBeNull();
  });

  it("maps type icons and tera crystals", () => {
    expect(typeIconUrl(assets, "water")).toBe("/assets/generated/sprites/typeicons/Water.png");
    expect(typeIconUrl(assets, "bird")).toBeNull();
    expect(teraIconUrl(assets, "Fire")).toBe("/assets/generated/sprites/types/TeraFire.png");
    expect(teraIconUrl(assets, "Water")).toBeNull();
  });

  it("slices the item sheet on a 16 by 24 grid", () => {
    expect(itemSpriteStyle(assets, 0).backgroundPosition).toBe("-0px -0px");
    expect(itemSpriteStyle(assets, 16).backgroundPosition).toBe("-0px -24px");
    expect(itemSpriteStyle(assets, 17)).toMatchObject({
      backgroundPosition: "-24px -24px",
      backgroundSize: "384px 1152px",
      width: "24px",
      height: "24px",
    });
    expect(itemSpriteStyle(assets, 17).backgroundImage).toContain("itemicons-sheet.png");
    expect(itemSpriteStyle(assets, -1).backgroundImage).toBe("none");
  });
});

describe("normalizeRuntimeIndex", () => {
  it("tolerates malformed payloads", () => {
    expect(normalizeRuntimeIndex(null)).toEqual(emptyRuntimeIndex());
    expect(normalizeRuntimeIndex({ sprites: { bad: [1, 2] }, fx: ["ok.png", 4] }).fx).toEqual(["ok.png"]);
  });
});

describe("preloadSprites", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes the first url of each chain", async () => {
    const decoded: string[] = [];
    vi.stubGlobal("Image", class {
      src = "";
      decoding = "";
      decode() {
        decoded.push(this.src);
        return Promise.resolve();
      }
    });
    await preloadSprites(index(), [
      { spriteId: "pikachu", facing: "front", animated: false },
      { spriteId: "missingno", facing: "front" },
    ]);
    expect(decoded).toEqual([url("gen5", "pikachu.png")]);
  });
});

describe("loadRuntimeIndex", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("resolves an empty index when the fetch fails", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const mod = await import("@/client/sprites/runtime-index");
    const loaded = await mod.loadRuntimeIndex();
    expect(loaded.sprites).toEqual({});
    expect(loaded.base).toBe("/assets/generated");
    expect(mod.fxUrl("impact")).toBeNull();
  });
});

describe("fx catalog", () => {
  it("lets move flags override type and category", () => {
    expect(moveFxPlan({ moveType: "Fire", category: "Special", flags: ["bite", "contact"] })).toMatchObject({
      images: ["topbite", "bottombite"],
      mode: "lunge",
    });
    expect(moveFxPlan({ moveType: "Fire", category: "Special", flags: [] })).toMatchObject({
      images: ["fireball"],
      mode: "projectile",
    });
    expect(moveFxPlan({ moveType: "Ground", category: "Physical", flags: [] })).toMatchObject({
      mode: "lunge",
      shake: true,
    });
    expect(moveFxPlan({ moveType: "Electric", category: "Status", flags: [] })).toMatchObject({
      images: ["electroball"],
      mode: "aura",
    });
    expect(moveFxPlan({ moveType: "Water", category: "Special", flags: ["bullet"] })).toMatchObject({
      mode: "projectile",
      images: ["waterwisp"],
    });
    expect(moveFxPlan({ moveType: "Normal", category: "Status", flags: ["sound"] })).toMatchObject({
      images: ["sound"],
      mode: "aura",
    });
    expect(moveFxPlan({ moveType: "???", category: "Physical", flags: ["contact"] })).toMatchObject({
      images: ["impact"],
      mode: "lunge",
    });
  });

  it("normalizes weather, terrain, rooms, and hazards", () => {
    expect(toAssetId("Electric Terrain")).toBe("electricterrain");
    expect(weatherOverlayFile("RainDance")).toBe("weather-raindance.jpg");
    expect(weatherOverlayFile("Desolate Land")).toBe("weather-sunnyday.jpg");
    expect(weatherOverlayFile("Snow")).toBe("weather-hail.png");
    expect(weatherOverlayFile("Hail")).toBe("weather-hail.png");
    expect(weatherOverlayFile(null)).toBeNull();
    expect(terrainOverlayFile("Grassy Terrain")).toBe("weather-grassyterrain.png");
    expect(pseudoOverlayFile("Trick Room")).toBe("weather-trickroom.png");
    expect(pseudoOverlayFile("Magic Room")).toBe("weather-magicroom.png");
    expect(hazardParticle("Stealth Rock")).toBe("rocks");
    expect(hazardParticle("Spikes")).toBe("caltrop");
    expect(hazardParticle("Toxic Spikes")).toBe("poisoncaltrop");
    expect(hazardParticle("Sticky Web")).toBe("web");
    expect(hazardParticle("Reflect")).toBeNull();
  });
});
