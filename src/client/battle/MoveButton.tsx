"use client";

import { useEffect, useRef, useState } from "react";
import type { MoveOption } from "@/shared/contract";
import { CategoryIcon, categoryLabel } from "@/client/ui/CategoryIcon.tsx";
import { TypeChip, typeColor } from "@/client/ui/TypeChip.tsx";
import { cx } from "@/client/ui/cx.ts";

function accuracyLabel(accuracy: number | true): string {
  return accuracy === true ? "Siempre" : `${accuracy}`;
}

export function MoveButton({
  move,
  disabled,
  onSelect,
}: {
  move: MoveOption;
  disabled: boolean;
  onSelect: (slot: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const suppress = useRef(false);
  const color = typeColor(move.type);
  const power = move.basePower > 0 ? String(move.basePower) : "—";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        disabled={disabled || move.disabled}
        onClick={() => {
          if (suppress.current) {
            suppress.current = false;
            return;
          }
          onSelect(move.slot);
        }}
        onPointerDown={() => {
          clearTimer();
          timer.current = window.setTimeout(() => {
            suppress.current = true;
            setOpen(true);
          }, 420);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        title={`${categoryLabel(move.category)} · Potencia ${power} · Precisión ${accuracyLabel(move.accuracy)}. ${move.shortDesc}`}
        className={cx(
          "flex min-h-14 w-full flex-col justify-center rounded-[var(--radius-card)] border px-2 py-1.5 text-left",
          "disabled:opacity-40",
        )}
        style={{ borderColor: color, background: `linear-gradient(180deg, ${color}33, #111729cc)` }}
      >
        <span className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wide" style={{ color }}>
          <span className="inline-flex items-center gap-1">
            <CategoryIcon category={move.category} />
            {categoryLabel(move.category)}
          </span>
          <TypeChip type={move.type} size="sm" />
        </span>
        <span className="truncate font-display text-sm font-bold leading-tight sm:text-base">{move.name}</span>
        <span className="tabular text-[11px] text-text-dim">
          PP {move.pp}/{move.maxPp}
          {move.basePower > 0 ? ` · Pot ${move.basePower}` : ""}
        </span>
      </button>
      {open ? (
        <div className="glass absolute inset-x-0 bottom-full z-30 mb-1 rounded-[var(--radius-card)] p-2 text-xs shadow-lg">
          <p>
            Potencia {power} · Precisión {accuracyLabel(move.accuracy)}
            {move.priority !== 0 ? ` · Prioridad ${move.priority > 0 ? `+${move.priority}` : move.priority}` : ""}
          </p>
          {move.shortDesc ? <p className="mt-1 text-text-dim">{move.shortDesc}</p> : null}
          <button type="button" className="mt-1 min-h-11 font-semibold uppercase text-accent-2" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  );
}
