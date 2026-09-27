import type { BattleEvent, BattleFrame, PublicBattleState } from "@/shared/contract";
import { playEventEffect } from "@/client/battle/fx/effects.ts";
import { applyEvent } from "./reducer.ts";
import type { LogLine } from "./log.ts";

export interface PlaybackContext {
  frames: BattleFrame[];
  state: PublicBattleState;
  signal: AbortSignal;
  getSpeed: () => number;
  getReduced: () => boolean;
  getArena: () => HTMLElement | null;
  onState: (state: PublicBattleState) => void;
  onLog: (line: Omit<LogLine, "id">) => void;
  onBanner: (turn: number | null) => void;
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const id = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function toLine(event: BattleEvent, turn: number): Omit<LogLine, "id"> {
  return {
    turn: event.kind === "turn" ? event.turn : turn,
    text: event.text,
    kind: event.kind,
    effectiveness: event.kind === "effectiveness" ? event.value : undefined,
  };
}

/**
 * Plays frame events in order. State changes are applied before each effect so
 * HP bars and sprites move with the animation. Abort returns "aborted" without
 * snapping; the caller adopts the authoritative state it wants.
 */
export async function playFrames(options: PlaybackContext): Promise<"done" | "aborted"> {
  let state = options.state;
  try {
    for (const frame of options.frames) {
      for (const event of frame.events) {
        if (options.signal.aborted) return "aborted";
        const next = applyEvent(state, event);
        // Keep the outgoing sprite present until the faint animation completes.
        if (event.kind !== "faint") {
          state = next;
          options.onState(state);
        }
        if (event.kind === "turn") options.onBanner(event.turn);

        const speed = Math.max(1, options.getSpeed());
        const reduced = options.getReduced();
        const arena = options.getArena();
        const effect = arena
          ? playEventEffect(event, { arena, reducedMotion: reduced, speed, signal: options.signal })
          : Promise.resolve();

        try {
          if (event.kind === "turn") {
            await Promise.all([effect, wait(reduced ? 120 : 700 / speed, options.signal)]);
            options.onBanner(null);
          } else {
            await effect;
          }
        } catch (error) {
          if (isAbort(error) || options.signal.aborted) {
            options.onBanner(null);
            return "aborted";
          }
        }

        if (options.signal.aborted) {
          options.onBanner(null);
          return "aborted";
        }
        if (event.kind === "faint") {
          state = next;
          options.onState(state);
        }
        if (event.text) options.onLog(toLine(event, state.turn));
      }
      state = frame.state;
      options.onState(frame.state);
    }
    options.onBanner(null);
    return "done";
  } catch (error) {
    options.onBanner(null);
    if (isAbort(error) || options.signal.aborted) return "aborted";
    throw error;
  }
}
