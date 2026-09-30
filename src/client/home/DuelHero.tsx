"use client";

import type { CSSProperties, ReactNode } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";

/** Red hero card with Garchomp vs Dragapult; `children` adds optional actions below the duel. */
export function DuelHero({ children, compact }: { children?: ReactNode; compact?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="type-card animate-pop-in rounded-[32px] p-5" style={{ "--card-color": "#dc2f3c" } as CSSProperties}>
      <PokeballDeco spinning className="-right-14 -top-14 w-52" />
      <span aria-hidden="true" className="dot-grid absolute left-4 top-16 -z-10 h-16 w-24 text-white opacity-25" />
      <div className="flex items-center justify-between">
        <span className="soft-pill px-2.5 py-0.5 text-xs">Un jugador</span>
        <span className="soft-pill px-2.5 py-0.5 text-xs">Gen 9 · vs CPU</span>
      </div>
      <div className={`home-duel mt-2 ${compact ? "is-compact" : ""}`} aria-label="Garchomp y Dragapult preparados para combatir">
        <div className="w-[46%]"><PokemonSprite spriteId="garchomp" facing="back" animated={!reduced} scale={1.8} alt="Garchomp de espaldas" /></div>
        <div className="w-[40%]"><PokemonSprite spriteId="dragapult" facing="front" animated={!reduced} scale={1.5} alt="Dragapult de frente" /></div>
      </div>
      {children ? <div className="mt-3 flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}
