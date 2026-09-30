import type { BattleEvent, BattleFrame, EffectivenessValue } from "@/shared/contract";

export interface LogLine {
  id: string;
  turn: number;
  text: string;
  kind: BattleEvent["kind"];
  effectiveness?: EffectivenessValue;
}

export function linesFromFrames(frames: BattleFrame[]): LogLine[] {
  const lines: LogLine[] = [];
  let turn = 0;
  for (const frame of frames) {
    for (const event of frame.events) {
      if (event.kind === "turn") turn = event.turn;
      if (!event.text) continue;
      lines.push({
        id: `${frame.index}:${lines.length}:${event.kind}`,
        turn: event.kind === "turn" ? event.turn : turn,
        text: event.text,
        kind: event.kind,
        effectiveness: event.kind === "effectiveness" ? event.value : undefined,
      });
    }
  }
  return lines;
}

export function logLineClass(line: LogLine): string {
  if (line.kind === "crit") return "font-semibold text-accent";
  if (line.effectiveness === "super") return "font-bold text-accent-2";
  if (line.effectiveness === "resisted" || line.effectiveness === "immune") return "text-text-dim";
  if (line.kind === "faint") return "text-danger";
  if (line.kind === "win") return "font-display font-bold uppercase tracking-wide text-accent";
  return "text-text";
}
