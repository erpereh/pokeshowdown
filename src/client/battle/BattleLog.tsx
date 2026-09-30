"use client";

import { useEffect, useRef } from "react";
import { logLineClass, type LogLine } from "./log.ts";

export function BattleLog({ lines, className }: { lines: LogLine[]; className?: string }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const groups: { turn: number; lines: LogLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (!last || last.turn !== line.turn) groups.push({ turn: line.turn, lines: [line] });
    else last.lines.push(line);
  }

  return (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Registro del combate" className={className}>
      {groups.length === 0 ? <p className="text-sm text-text-dim">El combate está a punto de empezar.</p> : null}
      <ol className="flex flex-col gap-3">
        {groups.map((group) => (
          <li key={`${group.turn}-${group.lines[0]?.id ?? "g"}`}>
            <h3 className="font-display inline-flex rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">{group.turn > 0 ? `Turno ${group.turn}` : "Comienzo"}</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {group.lines.map((line) => (
                <li key={line.id} className={`text-sm leading-snug ${logLineClass(line)}`}>
                  {line.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
