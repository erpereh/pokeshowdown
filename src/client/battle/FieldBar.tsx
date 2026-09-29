"use client";

import type { ReactNode } from "react";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { fieldLabel, sideConditionLabel } from "./labels.ts";
import type { PublicBattleState } from "@/shared/contract";

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-h-7 items-center rounded-full border border-line bg-black/35 px-2 text-[11px] font-semibold">{children}</span>;
}

export function FieldBar({
  state,
  trailing,
}: {
  state: PublicBattleState;
  trailing?: ReactNode;
}) {
  const weather = state.field.weather;
  const terrain = state.field.terrain;
  return (
    <div className="shrink-0 border-b border-line bg-bg-0/80 px-2 py-1.5 sm:px-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display shrink-0 text-sm font-semibold">
          Turno <span className="tabular text-accent">{state.turn}</span>
        </p>
        <div className="flex min-w-0 flex-wrap justify-end gap-1">{trailing}</div>
      </div>
      <div className="mt-1 flex max-w-full flex-wrap gap-1">
        {weather ? <Chip>{fieldLabel("weather", weather)}</Chip> : null}
        {terrain ? <Chip>{fieldLabel("terrain", terrain)}</Chip> : null}
        {state.field.pseudoWeather.map((effect) => (
          <Chip key={effect}>{fieldLabel("pseudo", effect)}</Chip>
        ))}
        {(["p1", "p2"] as const).map((id) => {
          const conditions = state.sides[id].conditions;
          if (conditions.length === 0) return null;
          return conditions.map((condition) => (
            <Chip key={`${id}-${condition.id}`}>
              {id === "p1" ? "Tú" : "Rival"} · {sideConditionLabel(condition.id, condition.name)}
              {condition.layers > 1 ? ` ×${condition.layers}` : ""}
            </Chip>
          ));
        })}
      </div>
    </div>
  );
}

export function SpeedSkip({
  speed,
  playing,
  onSpeed,
  onSkip,
}: {
  speed: 1 | 2;
  playing: boolean;
  onSpeed: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <GameButton type="button" variant="ghost" size="md" onClick={onSpeed} aria-label={`Velocidad ${speed}×`}>
        {speed}×
      </GameButton>
      {playing ? (
        <GameButton type="button" variant="secondary" size="md" onClick={onSkip}>
          Omitir
        </GameButton>
      ) : null}
    </>
  );
}
