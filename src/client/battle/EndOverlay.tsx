"use client";

import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { formatName } from "@/client/ui/format.ts";
import type { BattleView, PokemonView, PublicBattleState } from "@/shared/contract";

function spotlight(state: PublicBattleState): PokemonView | null {
  const side = state.sides.p1;
  return side.active ?? [...side.team].reverse().find((mon) => !mon.fainted) ?? side.team.at(-1) ?? null;
}

export function EndOverlay({ view, state }: { view: BattleView; state: PublicBattleState }) {
  const mon = spotlight(state);
  const forfeit = view.endReason === "forfeit";
  const headline = forfeit ? "Te has rendido" : view.result === "win" ? "¡VICTORIA!" : view.result === "tie" ? "EMPATE" : "DERROTA";
  const tone = view.result === "win" ? "text-accent" : view.result === "tie" ? "text-accent-2" : "text-danger";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className={`glass w-full max-w-md rounded-[var(--radius-panel)] px-5 py-6 text-center ${view.result === "loss" ? "saturate-50" : ""}`}>
        {mon ? <PokemonSprite spriteId={mon.spriteId} facing="front" shiny={mon.shiny} gender={mon.gender} animated alt={mon.name} className="mx-auto max-h-40" /> : null}
        <h2 id="end-title" className={`font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl ${tone}`}>
          {headline}
        </h2>
        <p className="mt-2 text-sm text-text-dim">
          Turno {view.turn} · {formatName(view.formatId)}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <GameLink href={`/play?format=${view.formatId}`} size="lg" className="w-full">
            Revancha
          </GameLink>
          <GameLink href={`/replay/${view.id}`} variant="secondary" className="w-full">
            Ver repetición
          </GameLink>
          <GameLink href="/" variant="ghost" className="w-full">
            Inicio
          </GameLink>
        </div>
      </div>
    </div>
  );
}
