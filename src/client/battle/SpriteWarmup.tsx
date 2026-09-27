"use client";

import { useEffect } from "react";
import { preloadSprites, useRuntimeIndex, type SpriteResolveOptions } from "@/client/sprites/runtime-index.ts";
import type { PublicBattleState } from "@/shared/contract";

export function SpriteWarmup({ state }: { state: PublicBattleState | null }) {
  const index = useRuntimeIndex();

  useEffect(() => {
    if (!index || !state) return;
    const list: SpriteResolveOptions[] = [];
    for (const side of [state.sides.p1, state.sides.p2]) {
      const mons = side.active ? [side.active, ...side.team] : side.team;
      for (const mon of mons) {
        list.push({ spriteId: mon.spriteId, shiny: mon.shiny, gender: mon.gender, facing: "front", animated: mon.active });
        list.push({ spriteId: mon.spriteId, shiny: mon.shiny, gender: mon.gender, facing: "back", animated: mon.active });
      }
    }
    try {
      void preloadSprites(index, list);
    } catch {
      // Preload is best-effort; the sprites still resolve on demand.
    }
  }, [index, state]);

  return null;
}
