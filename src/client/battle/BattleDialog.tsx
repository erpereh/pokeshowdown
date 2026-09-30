"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "./fx/useReducedMotion.ts";

/** Game-style narration box: types out the newest log line and opens the full log on tap. */
export function BattleDialog({ text, lineKey, onOpen }: { text: string; lineKey: string; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(text.length);

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((count) => {
        if (count >= text.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 2;
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [lineKey, text, reduced]);

  return (
    <button type="button" aria-label="Abrir registro del combate" onClick={onOpen} className="battle-dialog">
      <span aria-hidden="true" className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug">
        {text.slice(0, shown)}
        <span className="invisible">{text.slice(shown)}</span>
      </span>
      <span aria-hidden="true" className="battle-dialog-caret shrink-0" />
    </button>
  );
}
