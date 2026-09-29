"use client";

import { GlassPanel } from "@/client/ui/GlassPanel";
import type { PokemonSetData, ValidationProblem } from "@/shared/contract";
import type { KeyboardEvent } from "react";
import { EmptySlotMark } from "./controls";
import type { SpeciesBundle } from "./hooks";
import { MiniSprite } from "./media";
import { problemsForSlot, SLOT_COUNT } from "./model";

function spriteGender(gender: string): "M" | "F" | undefined {
  return gender === "M" || gender === "F" ? gender : undefined;
}

interface SlotRailProps {
  slots: ReadonlyArray<PokemonSetData | null>;
  selected: number;
  problems: readonly ValidationProblem[];
  bundleFor: (species: string) => SpeciesBundle | null;
  onSelect: (index: number) => void;
}

export function SlotRail({ slots, selected, problems, bundleFor, onSelect }: SlotRailProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? Math.min(SLOT_COUNT - 1, selected + 1) : Math.max(0, selected - 1);
    onSelect(next);
    document.getElementById(`slot-tab-${next}`)?.focus();
  }

  return (
    <GlassPanel as="section" aria-label="Ranuras del equipo" className="p-3">
      <h2 className="font-display mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Equipo</h2>
      <div role="tablist" aria-orientation="vertical" className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-1" onKeyDown={onKeyDown}>
        {slots.map((set, index) => {
          const count = set ? problemsForSlot(problems, slots, index).length : 0;
          const bundle = set ? bundleFor(set.species) : null;
          const active = index === selected;
          return (
            <button
              key={index}
              id={`slot-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="slot-editor"
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(index)}
              className={`relative flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] border px-2 py-2 text-left transition-[border-color,box-shadow,background-color] duration-[var(--dur-fast)] ${
                active
                  ? "border-accent-2 bg-white/5 shadow-[0_0_18px_#4fd1ff33]"
                  : "border-line bg-bg-0/40 hover:border-line-strong"
              }`}
            >
              {set && bundle ? (
                <MiniSprite
                  spriteId={bundle.species.spriteId}
                  alt={set.species}
                  size={48}
                  shiny={set.shiny}
                  gender={spriteGender(set.gender)}
                />
              ) : (
                <EmptySlotMark size={48} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold">{set?.species || "Vacío"}</span>
                <span className="block truncate text-xs text-text-dim">
                  {set ? set.item || "Sin objeto" : "Pulsa para editar"}
                </span>
                {count > 0 ? <span className="sr-only">{`, ${count} problemas de legalidad`}</span> : null}
              </span>
              {count > 0 ? (
                <span className="font-display inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
