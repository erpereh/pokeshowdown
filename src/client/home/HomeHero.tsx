"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { apiFetch } from "@/client/api.ts";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { Icon, type IconName } from "@/client/ui/Icon.tsx";
import { typeCardColor } from "@/client/ui/TypeChip.tsx";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";
import type { ListBattlesResponse } from "@/shared/contract";

interface Shortcut {
  href: string;
  title: string;
  hint: string;
  icon: IconName;
  type: string;
  spriteId: string;
}

function ShortcutCard({ item }: { item: Shortcut }) {
  return (
    <li>
      <Link
        href={item.href}
        className="type-card press flex min-h-28 flex-col justify-between rounded-[24px] p-4"
        style={{ "--card-color": typeCardColor(item.type) } as CSSProperties}
      >
        <PokeballDeco className="-bottom-6 -right-6 w-24" />
        <span className="card-title font-display text-lg font-bold leading-tight">{item.title}</span>
        <span className="soft-pill w-fit gap-1 px-2 py-0.5 text-[11px]"><Icon name={item.icon} className="size-3.5" />{item.hint}</span>
        <span className="animate-float pointer-events-none absolute -right-1 bottom-1 w-[4.5rem]">
          <PokemonSprite spriteId={item.spriteId} facing="front" animated={false} scale={1.6} alt="" className="drop-shadow-[0_4px_4px_rgb(0_0_0/0.2)]" />
        </span>
      </Link>
    </li>
  );
}

export function HomeHero({ loggedIn, name }: { loggedIn: boolean; name?: string | null }) {
  const reduced = useReducedMotion();
  const [continueId, setContinueId] = useState<string | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    apiFetch<ListBattlesResponse>("/api/battles?status=active")
      .then((response) => { if (!cancelled) setContinueId(response.battles[0]?.id ?? null); })
      .catch(() => { if (!cancelled) setContinueId(null); });
    return () => { cancelled = true; };
  }, [loggedIn]);

  const shortcuts: Shortcut[] = [
    ...(continueId ? [{ href: `/battle/${continueId}`, title: "Continuar partida", hint: "En curso", icon: "saved" as const, type: "Water", spriteId: "squirtle" }] : []),
    { href: "/teams", title: "Equipos", hint: "Editor OU", icon: "team", type: "Grass", spriteId: "bulbasaur" },
    { href: "/saved", title: "Partidas", hint: "Guardadas", icon: "saved", type: "Electric", spriteId: "pikachu" },
    { href: "/history", title: "Historial", hint: "Repeticiones", icon: "history", type: "Psychic", spriteId: "mew" },
  ];

  return (
    <section className="app-content mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 sm:pt-6">
      <div className="relative isolate mb-5">
        <PokeballDeco spinning className="-right-16 -top-20 w-56 text-text opacity-[0.05]" />
        <p className="section-kicker">{name ? `¡Hola, ${name}!` : "¡Bienvenido, Entrenador!"}</p>
        <h1 className="font-display mt-1 text-[clamp(2rem,9vw,3rem)] font-bold leading-[1.05]">¿Listo para combatir?</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.35fr_1fr] md:items-start">
        <div
          className="type-card animate-pop-in rounded-[32px] px-5 pb-5 pt-5"
          style={{ "--card-color": "#dc2f3c" } as CSSProperties}
        >
          <PokeballDeco spinning className="-right-14 -top-14 w-52" />
          <span aria-hidden="true" className="dot-grid absolute left-4 top-16 -z-10 h-16 w-24 text-white opacity-25" />
          <div className="flex items-center justify-between">
            <span className="soft-pill px-2.5 py-0.5 text-xs">Un jugador</span>
            <span className="soft-pill px-2.5 py-0.5 text-xs">Gen 9 · vs CPU</span>
          </div>
          <div className="home-duel mt-2" aria-label="Garchomp y Dragapult preparados para combatir">
            <div className="w-[46%]"><PokemonSprite spriteId="garchomp" facing="back" animated={!reduced} scale={1.8} alt="Garchomp de espaldas" /></div>
            <div className="w-[40%]"><PokemonSprite spriteId="dragapult" facing="front" animated={!reduced} scale={1.5} alt="Dragapult de frente" /></div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {loggedIn ? (
              <GameLink href="/play" size="lg" variant="secondary" className="w-full justify-between border-0 !text-accent">
                ¡A combatir!<Icon name="arrow" />
              </GameLink>
            ) : (
              <>
                <GameLink href="/auth" size="lg" variant="secondary" className="w-full justify-between border-0 !text-accent">Entrar<Icon name="arrow" /></GameLink>
                <GameLink href="/auth?mode=signup" variant="ghost" className="w-full !text-white hover:!bg-white/15">Crear cuenta</GameLink>
              </>
            )}
          </div>
        </div>

        {loggedIn ? (
          <ul className="stagger grid grid-cols-2 gap-3">
            {shortcuts.map((item) => <ShortcutCard key={item.href} item={item} />)}
          </ul>
        ) : (
          <div className="card animate-fade-up rounded-[28px] p-5">
            <h2 className="font-display text-xl font-bold">Tu estadio, tu estrategia</h2>
            <p className="mt-1 text-sm text-text-dim">Crea equipos OU, combate contra la CPU con el motor de Pokémon Showdown y revive tus combates en repetición.</p>
          </div>
        )}
      </div>
    </section>
  );
}
