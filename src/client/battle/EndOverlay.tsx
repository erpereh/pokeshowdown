"use client";

import type { CSSProperties } from "react";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { useDialog } from "@/client/ui/Modal.tsx";
import { formatName } from "@/client/ui/format.ts";
import type { BattleView, PokemonView, PublicBattleState } from "@/shared/contract";

const CONFETTI = ["#dc2f3c", "#ffd23f", "#4a63e8", "#26a377", "#ec5b8c", "#ffffff"];

function spotlight(state: PublicBattleState): PokemonView | null {
  const side = state.sides.p1;
  return side.active ?? [...side.team].reverse().find((mon) => !mon.fainted) ?? side.team.at(-1) ?? null;
}

export function EndOverlay({ view, state }: { view: BattleView; state: PublicBattleState }) {
  const ref = useDialog(true);
  const mon = spotlight(state);
  const forfeit = view.endReason === "forfeit";
  const win = view.result === "win" && !forfeit;
  const headline = forfeit ? "Te has rendido" : view.result === "win" ? "¡VICTORIA!" : view.result === "tie" ? "EMPATE" : "DERROTA";
  const color = forfeit ? "#5f6b7a" : view.result === "win" ? "#26a377" : view.result === "tie" ? "#4a63e8" : "#dc2f3c";

  return (
    <div ref={ref} tabIndex={-1} className="animate-overlay-in absolute inset-0 z-40 flex items-end justify-center overflow-y-auto bg-[#1b2230]/55 p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className={`card w-full max-w-md overflow-hidden rounded-[32px] text-center ${win ? "animate-pop-in" : "animate-shake"}`}>
        <div className="result-hero px-5 pb-12 pt-5" style={{ "--result-color": color } as CSSProperties}>
          <PokeballDeco spinning className="-right-12 -top-12 w-48 text-white opacity-20" />
          {win
            ? CONFETTI.flatMap((tone, index) => [0, 1].map((round) => (
                <span
                  key={`${index}-${round}`}
                  aria-hidden="true"
                  className="confetti"
                  style={{ left: `${8 + ((index * 2 + round) * 97) % 84}%`, background: tone, animationDelay: `${(index * 2 + round) * 180}ms` }}
                />
              )))
            : null}
          <p className="soft-pill mx-auto px-3 py-0.5 text-xs">Combate completado · Turno {view.turn}</p>
          <h2 id="end-title" className="font-display mt-2 text-4xl font-bold uppercase tracking-wide [text-shadow:0_2px_4px_rgb(0_0_0/0.2)] sm:text-5xl">
            {headline}
          </h2>
          {mon ? <PokemonSprite spriteId={mon.spriteId} facing="front" shiny={mon.shiny} gender={mon.gender} animated alt={mon.name} className={`animate-float mx-auto mt-2 max-h-40 ${view.result === "loss" ? "grayscale" : ""}`} /> : null}
        </div>
        <div className="sheet-surface -mt-8 px-5 pb-5 pt-6">
          <p className="text-sm font-semibold text-text-dim">{formatName(view.formatId)}</p>
          <div className="mt-4 flex flex-col gap-2">
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
    </div>
  );
}
