"use client";

import { useEffect, useRef } from "react";
import { cx } from "./cx.ts";

function tone(ratio: number): string {
  if (ratio <= 0.2) return "bg-hp-low";
  if (ratio <= 0.5) return "bg-hp-mid";
  return "bg-hp-high";
}

export function HpBar({
  hp,
  maxHp,
  reveal,
  className,
}: {
  hp: number;
  maxHp: number;
  reveal: "exact" | "percent";
  className?: string;
}) {
  const safeMax = maxHp > 0 ? maxHp : 1;
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const pct = Math.round(ratio * 100);
  const prev = useRef(pct);
  const lost = Math.abs(prev.current - pct);
  const duration = lost > 0 ? Math.min(900, Math.max(300, lost * 10)) : 400;

  useEffect(() => {
    prev.current = pct;
  }, [pct]);

  const label = reveal === "exact" ? `${Math.max(0, hp)}/${Math.max(0, maxHp)}` : `${pct}%`;

  return (
    <div className={cx("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-display rounded bg-[#f5b82e] px-1 text-[10px] font-bold leading-4 text-[#3a2a00]">PS</span>
        <span className="tabular font-semibold">{label}</span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-[#3b4455] p-px" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Puntos de salud ${label}`}>
        <div
          className={cx("h-full rounded-full", tone(ratio), ratio > 0 && ratio <= 0.2 && "animate-pulse")}
          style={{ width: `${pct}%`, transition: `width ${duration}ms var(--ease-out-game), background-color 300ms` }}
        />
      </div>
    </div>
  );
}
