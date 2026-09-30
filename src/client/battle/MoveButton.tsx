"use client";

import { useState, type CSSProperties } from "react";
import type { MoveOption } from "@/shared/contract";
import { CategoryIcon, categoryLabel } from "@/client/ui/CategoryIcon.tsx";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { TypeChip, typeCardColor } from "@/client/ui/TypeChip.tsx";
import { Sheet } from "@/client/ui/Modal.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { cx } from "@/client/ui/cx.ts";

export function MoveButton({ move, disabled, tera, onSelect }: { move: MoveOption; disabled: boolean; tera?: boolean; onSelect: (slot: number) => void }) {
  const [open, setOpen] = useState(false);
  const power = move.basePower > 0 ? String(move.basePower) : "—";
  const blocked = disabled || move.disabled;
  return (
    <div className={cx("move-choice press min-w-0", tera && "is-tera", blocked && "opacity-45 grayscale")} style={{ "--move-color": typeCardColor(move.type) } as CSSProperties}>
      <PokeballDeco />
      <button type="button" aria-label={move.name} disabled={blocked} onClick={() => onSelect(move.slot)} className="flex min-h-[76px] w-full flex-col justify-between gap-1 px-3 pb-2.5 pt-2.5 text-left">
        <span className="font-display w-full break-words pr-8 text-base font-semibold leading-tight [text-shadow:0_1px_2px_rgb(0_0_0/0.2)]">{move.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold">
          <TypeChip type={move.type} size="sm" tone="soft" />
          <span aria-label={categoryLabel(move.category)} className="soft-pill px-1.5 py-0.5"><CategoryIcon category={move.category} className="size-3" /></span>
          <span className="tabular ml-auto">PP {move.pp}/{move.maxPp}</span>
        </span>
      </button>
      <button type="button" aria-label={`Detalles de ${move.name}`} onClick={() => setOpen(true)} className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-bl-[16px] text-white/85 hover:bg-white/15 hover:text-white"><Icon name="info" className="size-[18px]" /></button>
      <Sheet open={open} title={move.name} onClose={() => setOpen(false)}>
        <div className="mb-4 flex items-center gap-3"><TypeChip type={move.type} /><span className="font-display inline-flex items-center gap-2 text-sm font-semibold"><CategoryIcon category={move.category} />{categoryLabel(move.category)}</span></div>
        <dl className="grid grid-cols-3 gap-3 rounded-[var(--radius-card)] bg-surface-2 p-4 text-center text-sm">
          <div><dt className="text-xs text-text-dim">Potencia</dt><dd className="font-display mt-1 text-lg font-bold">{power}</dd></div>
          <div><dt className="text-xs text-text-dim">Precisión</dt><dd className="font-display mt-1 text-lg font-bold">{move.accuracy === true ? "Siempre" : `${move.accuracy}%`}</dd></div>
          <div><dt className="text-xs text-text-dim">PP</dt><dd className="font-display mt-1 text-lg font-bold">{move.pp}/{move.maxPp}</dd></div>
        </dl>
        {move.priority !== 0 ? <p className="mt-4 text-sm">Prioridad {move.priority > 0 ? "+" : ""}{move.priority}</p> : null}
        {move.shortDesc ? <p className="my-4 text-sm leading-relaxed text-text-dim">{move.shortDesc}</p> : null}
      </Sheet>
    </div>
  );
}
