"use client";

import { Pokeball } from "@/client/ui/Card.tsx";
import { GameButton, GameLink } from "@/client/ui/GameButton.tsx";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Pokeball className="animate-shake mb-4 size-16 grayscale" />
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-danger">Error</p>
      <h1 className="font-display mt-1 text-4xl font-bold">Algo ha fallado</h1>
      <p className="mt-2 max-w-md text-text-dim">El combate se ha interrumpido. Puedes reintentar o volver al inicio.</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <GameButton type="button" onClick={() => reset()}>
          Reintentar
        </GameButton>
        <GameLink href="/" variant="secondary">
          Inicio
        </GameLink>
      </div>
    </main>
  );
}
