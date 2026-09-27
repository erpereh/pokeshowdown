"use client";

import { useState, type ReactNode, type RefObject } from "react";
import type { PublicBattleState } from "@/shared/contract";
import { Sheet } from "@/client/ui/Modal.tsx";
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden">
      {top}
      <div className={`flex min-h-0 flex-1 flex-col lg:flex-row ${muted ? "saturate-50" : ""}`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Arena ref={arenaRef} state={state} background={background} bannerTurn={bannerTurn} />
          <button type="button" onClick={() => setLogOpen(true)} className="flex min-h-11 w-full items-center border-y border-line px-3 text-left text-sm lg:hidden">
            <span className="truncate text-text-dim">{last?.text ?? "Registro del combate"}</span>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{bottom}</div>
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
