"use client";

import { Card } from "@/client/ui/Card";
import { typeCardColor } from "@/client/ui/TypeChip";
import type { CSSProperties } from "react";
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
    <Card as="section" aria-label="Ranuras del equipo" className="p-3">
      <h2 className="font-display mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Equipo</h2>
      <div role="tablist" aria-orientation="vertical" className="stagger grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-1" onKeyDown={onKeyDown}>
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
              style={set && bundle ? ({ "--card-color": typeCardColor(bundle.species.types[0]) } as CSSProperties) : undefined}
              className={`press relative flex min-h-16 w-full items-center gap-3 rounded-[20px] px-2 py-2 text-left ${
                set && bundle ? "type-card" : "border-2 border-dashed border-line-strong bg-surface-2"
              } ${active ? "outline outline-3 outline-offset-2 outline-accent-2" : ""}`}
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
                <span className={`block truncate text-xs ${set && bundle ? "text-white/85" : "text-text-dim"}`}>
                  {set ? set.item || "Sin objeto" : "Pulsa para editar"}
                </span>
                {count > 0 ? <span className="sr-only">{`, ${count} problemas de legalidad`}</span> : null}
              </span>
              {count > 0 ? (
                <span className="font-display inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-danger shadow">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
