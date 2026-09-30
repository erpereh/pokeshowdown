import { PokeballDeco } from "@/client/ui/Card.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { DuelHero } from "./DuelHero.tsx";

/** Landing for visitors without a session; signed-in players land on /play. */
export function HomeHero() {
  return (
    <section className="app-content mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 sm:pt-6">
      <div className="relative isolate mb-5">
        <PokeballDeco spinning className="-right-16 -top-20 w-56 text-text opacity-[0.05]" />
        <h1 className="font-display text-[clamp(2rem,9vw,3rem)] font-bold leading-[1.05]">¿Listo para combatir?</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.35fr_1fr] md:items-start">
        <DuelHero>
          <GameLink href="/auth" size="lg" variant="secondary" className="w-full justify-between border-0 !text-accent">Entrar<Icon name="arrow" /></GameLink>
          <GameLink href="/auth?mode=signup" variant="ghost" className="w-full !text-white hover:!bg-white/15">Crear cuenta</GameLink>
        </DuelHero>
        <div className="card animate-fade-up rounded-[28px] p-5">
          <h2 className="font-display text-xl font-bold">Tu estadio, tu estrategia</h2>
          <p className="mt-1 text-sm text-text-dim">Crea equipos OU, combate contra la CPU con el motor de Pokémon Showdown y revive tus combates en repetición.</p>
        </div>
      </div>
    </section>
  );
}
