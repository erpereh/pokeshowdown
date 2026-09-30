export function TurnBanner({ turn }: { turn: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <p className="animate-pop-in font-display rounded-full border-[3px] border-battle-frame bg-surface px-6 py-1.5 text-3xl font-bold uppercase tracking-[0.12em] text-text shadow-[0_10px_30px_-10px_#000000aa]">Turno {turn}</p>
    </div>
  );
}
