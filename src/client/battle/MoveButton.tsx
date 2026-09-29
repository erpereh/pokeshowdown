"use client";

import { useState, type CSSProperties } from "react";
import type { MoveOption } from "@/shared/contract";
import { CategoryIcon, categoryLabel } from "@/client/ui/CategoryIcon.tsx";
import { TypeChip, typeColor } from "@/client/ui/TypeChip.tsx";
import { Sheet } from "@/client/ui/Modal.tsx";
import { Icon } from "@/client/ui/Icon.tsx";

export function MoveButton({ move, disabled, onSelect }: { move: MoveOption; disabled: boolean; onSelect: (slot: number) => void }) {
  const [open, setOpen] = useState(false);
  const color = typeColor(move.type);
  const power = move.basePower > 0 ? String(move.basePower) : "—";
  return (
    <div className="move-choice relative min-w-0" style={{ "--move-color": color } as CSSProperties}>
      <button type="button" aria-label={move.name} disabled={disabled || move.disabled} onClick={() => onSelect(move.slot)} className="flex min-h-20 w-full flex-col justify-center gap-1 rounded-[var(--radius-card)] px-3 pb-3 pt-2 text-left disabled:opacity-40">
        <span className="flex items-center justify-between gap-1.5 text-[10px] text-text-dim"><span aria-label={categoryLabel(move.category)}><CategoryIcon category={move.category} /></span><TypeChip type={move.type} size="sm" /></span>
        <span className="font-display w-full break-words text-sm font-semibold leading-tight sm:text-base">{move.name}</span>
        <span className="tabular pr-9 text-[11px] text-text-dim">PP {move.pp}/{move.maxPp}</span>
      </button>
      <button type="button" aria-label={`Detalles de ${move.name}`} onClick={() => setOpen(true)} className="absolute bottom-0 right-0 flex size-12 items-center justify-center rounded-[var(--radius-card)] text-text-dim hover:bg-white/5 hover:text-text"><Icon name="info" className="size-4" /></button>
      <Sheet open={open} title={move.name} onClose={() => setOpen(false)}>
        <div className="mb-4 flex items-center gap-3"><TypeChip type={move.type} /><span className="inline-flex items-center gap-2 text-sm"><CategoryIcon category={move.category} />{categoryLabel(move.category)}</span></div>
        <dl className="grid grid-cols-3 gap-3 rounded-[var(--radius-card)] bg-bg-0/60 p-4 text-center text-sm">
          <div><dt className="text-xs text-text-dim">Potencia</dt><dd className="mt-1 font-semibold">{power}</dd></div>
          <div><dt className="text-xs text-text-dim">Precisión</dt><dd className="mt-1 font-semibold">{move.accuracy === true ? "Siempre" : `${move.accuracy}%`}</dd></div>
          <div><dt className="text-xs text-text-dim">PP</dt><dd className="mt-1 font-semibold">{move.pp}/{move.maxPp}</dd></div>
        </dl>
        {move.priority !== 0 ? <p className="mt-4 text-sm">Prioridad {move.priority > 0 ? "+" : ""}{move.priority}</p> : null}
        {move.shortDesc ? <p className="my-4 text-sm leading-relaxed text-text-dim">{move.shortDesc}</p> : null}
      </Sheet>
    </div>
  );
}
