export function TurnBanner({ turn }: { turn: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <p className="animate-fade-up font-display text-4xl font-bold uppercase tracking-[0.18em] text-accent drop-shadow-[0_6px_24px_#000]">Turno {turn}</p>
    </div>
  );
}
