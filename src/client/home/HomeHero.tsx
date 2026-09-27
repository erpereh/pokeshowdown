"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { apiFetch } from "@/client/api.ts";
import { GameLink } from "@/client/ui/GameButton.tsx";
import type { ListBattlesResponse } from "@/shared/contract";

const ARENA = "/assets/generated/sprites/gen6bgs/bg-skypillar.jpg";

function useNarrow() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(max-width: 639px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}

export function HomeHero({ loggedIn }: { loggedIn: boolean }) {
  const narrow = useNarrow();
  const [bgOk, setBgOk] = useState(true);
  const [continueId, setContinueId] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    apiFetch<ListBattlesResponse>("/api/battles?status=active")
      .then((response) => {
        if (!cancelled) setContinueId(response.battles[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setContinueId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  return (
    <section className="relative min-h-dvh overflow-hidden">
      {bgOk ? (
        <img src={ARENA} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setBgOk(false)} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#1a2748,#0a0e1a_70%)]" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0e1a_78%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-0 via-bg-0/25 to-bg-0/75" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-end px-4 pb-28 pt-24 md:justify-center md:pb-16">
        <div className="mb-2 flex w-full max-w-full items-end justify-between gap-2">
          <PokemonSprite spriteId="garchomp" facing="back" animated scale={narrow ? 1.15 : 2} alt="Garchomp de espaldas" />
          <PokemonSprite spriteId="dragapult" facing="front" animated scale={narrow ? 1.15 : 2} alt="Dragapult de frente" />
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-accent-2">Estadio nocturno</p>
        <h1 className="font-display max-w-full text-center text-[clamp(2rem,9vw,4.5rem)] font-bold leading-none">
          Poke<span className="text-accent">Showdown</span>
        </h1>
        <p className="mt-3 max-w-md text-center text-text-dim">Combates competitivos de singles contra la CPU. Pokémon Showdown resuelve cada turno.</p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          {loggedIn ? (
            <>
              <GameLink href="/play" size="lg" className="w-full">
                Jugar contra la CPU
              </GameLink>
              <GameLink href="/teams" variant="secondary" size="lg" className="w-full">
                Team Builder
              </GameLink>
              {continueId ? (
                <GameLink href={`/battle/${continueId}`} variant="secondary" size="lg" className="w-full">
                  Continuar partida
                </GameLink>
              ) : null}
              <GameLink href="/history" variant="ghost" size="lg" className="w-full">
                Historial
              </GameLink>
            </>
          ) : (
            <>
              <GameLink href="/auth" size="lg" className="w-full">
                Entrar
              </GameLink>
              <GameLink href="/auth?mode=signup" variant="secondary" size="lg" className="w-full">
                Crear cuenta
              </GameLink>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
