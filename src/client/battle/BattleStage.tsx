"use client";

import { useState, type ReactNode, type RefObject } from "react";
import type { PublicBattleState } from "@/shared/contract";
import { Sheet } from "@/client/ui/Modal.tsx";
import { Arena } from "./Arena.tsx";
import { BattleDialog } from "./BattleDialog.tsx";
import { BattleLog } from "./BattleLog.tsx";
import type { LogLine } from "./log.ts";

export function BattleStage({
  state,
  background,
  bannerTurn,
  arenaRef,
  lines,
  prompt,
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
  /** Narration shown while the game waits for the player (replaces the last log line). */
  prompt?: string | null;
  muted?: boolean;
  top: ReactNode;
  bottom: ReactNode;
  overlay?: ReactNode;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const last = lines[lines.length - 1];
  const text = prompt ?? last?.text ?? "¡Empieza el combate!";
  const lineKey = prompt ? `prompt:${prompt}` : (last?.id ?? "start");

  return (
    <div className="battle-stage relative flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden">
      {top}
      <div className={`flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-4 lg:px-4 ${muted ? "saturate-50" : ""}`}>
        <div className="battle-workspace flex min-h-0 min-w-0 flex-1 flex-col">
          <Arena ref={arenaRef} state={state} background={background} bannerTurn={bannerTurn} />
          <div className="battle-controls min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto w-full max-w-3xl px-3 pt-4 sm:px-4">
              <BattleDialog text={text} lineKey={lineKey} onOpen={() => setLogOpen(true)} />
            </div>
            {bottom}
          </div>
        </div>
        <aside className="card my-3 hidden w-80 shrink-0 overflow-y-auto rounded-[24px] p-4 lg:block">
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
