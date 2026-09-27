import { Spinner } from "@/client/ui/GameButton.tsx";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <Spinner />
      <p className="font-display text-sm uppercase tracking-[0.18em] text-text-dim">Cargando…</p>
    </main>
  );
}
