"use client";

import { useEffect, useState } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { apiFetch } from "@/client/api.ts";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";
import type { ListBattlesResponse } from "@/shared/contract";

export function HomeHero({ loggedIn }: { loggedIn: boolean }) {
  const reduced = useReducedMotion();
  const [bgOk, setBgOk] = useState(true);
  const [continueId, setContinueId] = useState<string | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    apiFetch<ListBattlesResponse>("/api/battles?status=active")
      .then((response) => { if (!cancelled) setContinueId(response.battles[0]?.id ?? null); })
      .catch(() => { if (!cancelled) setContinueId(null); });
    return () => { cancelled = true; };
  }, [loggedIn]);

  return (
    <section className="lobby relative min-h-dvh overflow-hidden">
      {bgOk ? <picture className="pointer-events-none absolute inset-0 -z-20">
        <source media="(max-width: 767px)" srcSet="/assets/brand/stadium-mobile.webp" />
        <img src="/assets/brand/stadium-desktop.webp" alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-top" onError={() => setBgOk(false)} />
      </picture> : null}
      <div className="lobby-shade pointer-events-none absolute inset-0 -z-10" />
      <div className="lobby-content mx-auto grid w-full max-w-6xl items-end gap-5 px-5 pt-24 md:grid-cols-2 md:items-center md:gap-10 md:px-8">
        <div className="order-2 mx-auto w-full max-w-md md:order-1 md:mx-0">
          <p className="section-kicker mb-3 flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent-2" />Tu estadio. Tu estrategia.</p>
          <h1 className="lobby-title font-display text-[clamp(2.5rem,10vw,4rem)] font-semibold leading-none tracking-[-0.055em] md:text-[clamp(2.5rem,5vw,4rem)]">Poke<span className="text-accent">Showdown</span></h1>
          <p className="mt-3 text-sm text-text-dim md:text-base">Tu próxima victoria empieza aquí.</p>
          <div className="glass-light mt-7 rounded-[var(--radius-panel)] p-3">
            <div className="mb-3 flex items-center justify-between px-2 text-xs text-text-dim"><span>Un jugador</span><span>Gen 9 · vs CPU</span></div>
            <div className="flex flex-col gap-2">
              {loggedIn ? <>
                <GameLink href="/play" size="lg" className="w-full justify-between">Jugar<Icon name="arrow" /></GameLink>
                {continueId ? <GameLink href={`/battle/${continueId}`} variant="secondary" className="w-full justify-between"><span>Continuar partida</span><Icon name="saved" /></GameLink> : null}
              </> : <>
                <GameLink href="/auth" size="lg" className="w-full justify-between">Entrar<Icon name="arrow" /></GameLink>
                <GameLink href="/auth?mode=signup" variant="secondary" className="w-full">Crear cuenta</GameLink>
              </>}
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-text-dim/90 md:text-left">Combates Pokémon · A tu ritmo</p>
        </div>
        <div className="lobby-duel order-1 w-full md:order-2" aria-label="Garchomp y Dragapult en el estadio">
          <div className="w-[42%]"><PokemonSprite spriteId="garchomp" facing="back" animated={!reduced} scale={1.8} alt="Garchomp de espaldas" /></div>
          <div className="w-[42%]"><PokemonSprite spriteId="dragapult" facing="front" animated={!reduced} scale={1.6} alt="Dragapult de frente" /></div>
        </div>
      </div>
    </section>
  );
}
