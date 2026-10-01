"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/client/ui/cx.ts";
import { formatCountdown, secondsLeft, useServerClock } from "@/client/social/time.ts";
import type { OnlineBattleInfo } from "@/shared/contract";

/** Rival name, connection and the authoritative per-decision timer of an online battle. */
export function OnlineHud({ online, active, onExpire }: { online: OnlineBattleInfo; active: boolean; onExpire: () => void }) {
  const now = useServerClock(500);
  const mine = online.myPending ? secondsLeft(online.myDeadline, now) : null;
  const theirs = online.opponentPending ? secondsLeft(online.opponentDeadline, now) : null;
  const shown = mine ?? theirs;
  const deadline = mine !== null ? online.myDeadline : theirs !== null ? online.opponentDeadline : null;
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (!active || shown !== 0 || !deadline || fired.current === deadline) return;
    fired.current = deadline;
    // The server resolves the timeout on the next read; give its clock a moment to pass the deadline.
    const timer = window.setTimeout(onExpire, 800);
    return () => window.clearTimeout(timer);
  }, [active, deadline, onExpire, shown]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold" data-testid="online-rival">
        <span className={cx("presence-dot", online.opponentOnline && "is-online")} aria-hidden="true" />
        <span className="truncate">{online.opponentName}</span>
        <span className="sr-only">{online.opponentOnline ? "conectado" : "desconectado"}</span>
      </span>
      {active && shown !== null ? (
        <span
          role="timer"
          aria-label={mine !== null ? "Tu tiempo para decidir" : "Tiempo del rival"}
          className={cx(
            "font-display tabular rounded-full px-2.5 py-1 text-xs font-bold",
            mine !== null && shown <= 10 ? "animate-pulse bg-danger text-white" : mine !== null ? "bg-accent/10 text-accent" : "bg-surface-2 text-text-dim",
          )}
        >
          {mine !== null ? "Tú" : "Rival"} {formatCountdown(shown)}
        </span>
      ) : null}
    </div>
  );
}
