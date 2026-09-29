"use client";

import { useState, type ReactNode, type RefObject } from "react";
import type { PublicBattleState } from "@/shared/contract";
import { Sheet } from "@/client/ui/Modal.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { Arena } from "./Arena.tsx";
import { BattleLog } from "./BattleLog.tsx";
import type { LogLine } from "./log.ts";

export function BattleStage({
  state,
  background,
  bannerTurn,
  arenaRef,
  lines,
  muted,
  top,
  bottom,
  overlay,
}: {
  state: PublicBattleState;
  background: string;
  bannerTurn: number | null;
  arenaRef: RefObject<HTMLDivElement | null>;
  lines: LogLine[];
  muted?: boolean;
  top: ReactNode;
  bottom: ReactNode;
  overlay?: ReactNode;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const last = lines[lines.length - 1];

  return (
    <div className="battle-stage relative flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden">
      {top}
      <div className={`flex min-h-0 flex-1 flex-col lg:flex-row ${muted ? "saturate-50" : ""}`}>
        <div className="battle-workspace flex min-h-0 min-w-0 flex-1 flex-col">
          <Arena ref={arenaRef} state={state} background={background} bannerTurn={bannerTurn} />
          <button type="button" aria-label="Abrir registro del combate" onClick={() => setLogOpen(true)} className="battle-log-trigger flex min-h-12 w-full shrink-0 items-center gap-3 border-y border-line px-4 text-left text-xs lg:hidden">
            <Icon name="history" className="size-4 shrink-0 text-accent-2" /><span className="flex-1 truncate text-text-dim">{last?.text ?? "Registro del combate"}</span><span className="text-accent-2">Ver</span>
          </button>
          <div className="battle-controls min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{bottom}</div>
        </div>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line p-3 lg:block">
          <BattleLog lines={lines} className="min-h-full" />
        </aside>
      </div>
      <Sheet open={logOpen} title="Registro" onClose={() => setLogOpen(false)}>
        <BattleLog lines={lines} />
      </Sheet>
      {overlay}
    </div>
  );
}
