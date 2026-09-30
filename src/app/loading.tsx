import { Pokeball } from "@/client/ui/Card.tsx";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-label="Cargando">
      <Pokeball className="animate-wobble size-16 origin-bottom" />
      <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-dim">Cargando…</p>
    </main>
  );
}
