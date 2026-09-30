"use client";

import { forwardRef } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { backgroundUrl } from "@/client/sprites/runtime-index.ts";
import { WeatherOverlay } from "@/client/battle/fx/WeatherOverlay.tsx";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";
import type { PublicBattleState, SideId } from "@/shared/contract";
import { HudCard } from "./HudCard.tsx";
import { TurnBanner } from "./TurnBanner.tsx";

function SpriteSlot({ side, state, reduced }: { side: SideId; state: PublicBattleState; reduced: boolean }) {
  const mon = state.sides[side].active;
  const foe = side === "p2";
  return (
    <div
      data-fx-sprite={side}
      className={
        foe
          ? "arena-foe absolute right-[3%] top-[8%] z-10 flex justify-center"
          : "arena-player absolute bottom-[8%] left-[2%] z-10 flex justify-center lg:bottom-[4%]"
      }
    >
      <div className="enter-sprite relative flex w-full justify-center">
        <div className="arena-platform" />
        {mon ? (
          <PokemonSprite
            spriteId={mon.spriteId}
            facing={foe ? "front" : "back"}
            shiny={mon.shiny}
            gender={mon.gender}
            animated={!reduced && !mon.fainted}
            scale={foe ? 1.55 : 2.1}
            alt={mon.name}
            className={mon.fainted ? "opacity-40 grayscale" : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}

export const Arena = forwardRef<HTMLDivElement, { state: PublicBattleState; background: string; bannerTurn: number | null }>(
  function Arena({ state, background, bannerTurn }, ref) {
    const reduced = useReducedMotion();
    const backgroundSrc = backgroundUrl(background);
    return (
      <div
        ref={ref}
        className="battle-arena"
      >
        {backgroundSrc ? <img src={backgroundSrc} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <WeatherOverlay weather={state.field.weather} terrain={state.field.terrain} pseudoWeather={state.field.pseudoWeather} />
        <SpriteSlot side="p2" state={state} reduced={reduced} />
        <SpriteSlot side="p1" state={state} reduced={reduced} />
        <div data-fx-layer className="pointer-events-none absolute inset-0 z-[15]" />
        <div className="absolute left-[3%] top-[4%] z-20 w-[min(48%,230px)]">
          <HudCard sideId="p2" side={state.sides.p2} />
        </div>
        <div className="absolute bottom-[9%] right-[3%] z-20 w-[min(50%,240px)] lg:bottom-[4%]">
          <HudCard sideId="p1" side={state.sides.p1} />
        </div>
        {bannerTurn !== null ? <TurnBanner turn={bannerTurn} /> : null}
      </div>
    );
  },
);
