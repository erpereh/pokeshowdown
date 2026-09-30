import { Pokeball } from "@/client/ui/Card.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Pokeball className="animate-float mb-4 size-16" />
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">404</p>
      <h1 className="font-display mt-1 text-4xl font-bold">Esta página no existe</h1>
      <p className="mt-2 max-w-md text-text-dim">El camino que buscas no está en el estadio.</p>
      <GameLink href="/" className="mt-6">
        Inicio
      </GameLink>
    </main>
  );
}
