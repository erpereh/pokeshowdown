"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiRequestError, apiFetch } from "@/client/api.ts";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { GameButton, Spinner } from "@/client/ui/GameButton.tsx";
import type { BattleFrame, GetReplayResponse, PublicBattleState, ReplayView } from "@/shared/contract";
import { BattleStage } from "./BattleStage.tsx";
import { playFrames } from "./director.ts";
import { FieldBar } from "./FieldBar.tsx";
import { linesFromFrames, type LogLine } from "./log.ts";
import { SpriteWarmup } from "./SpriteWarmup.tsx";

function endCursorForTurn(frames: BattleFrame[], turn: number): number {
  if (turn <= 0) return 0;
  let cursor = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (frame && frame.state.turn <= turn) cursor = index + 1;
  }
  return cursor;
}

export function ReplayScreen({ replayId }: { replayId: string }) {
  const reducedMotion = useReducedMotion();
  const [replay, setReplay] = useState<ReplayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [state, setState] = useState<PublicBattleState | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [bannerTurn, setBannerTurn] = useState<number | null>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(0);
  const speedRef = useRef(speed);
  const reducedRef = useRef(reducedMotion);
  const abortRef = useRef<AbortController | null>(null);
  const run = useRef(0);
  const replayRef = useRef<ReplayView | null>(null);

  speedRef.current = speed;
  reducedRef.current = reducedMotion;
  replayRef.current = replay;

  const paint = useCallback((nextCursor: number, source: ReplayView) => {
    const clamped = Math.max(0, Math.min(source.frames.length, nextCursor));
    cursorRef.current = clamped;
    setCursor(clamped);
    setState(clamped === 0 ? source.initialState : (source.frames[clamped - 1]?.state ?? source.initialState));
    setLines(linesFromFrames(source.frames.slice(0, clamped)));
    setBannerTurn(null);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch<GetReplayResponse>(`/api/replays/${replayId}`);
      setReplay(response.replay);
      paint(0, response.replay);
    } catch (reason: unknown) {
      setError(reason instanceof ApiRequestError ? reason.message : "No se pudo cargar la repetición.");
    }
  }, [paint, replayId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stop = useCallback(() => {
    run.current += 1;
    abortRef.current?.abort();
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (nextCursor: number) => {
      const source = replayRef.current;
      if (!source) return;
      stop();
      paint(nextCursor, source);
    },
    [paint, stop],
  );

  const play = useCallback(async () => {
    const source = replayRef.current;
    if (!source) return;
    if (cursorRef.current >= source.frames.length) paint(0, source);
    const my = ++run.current;
    setPlaying(true);
    while (run.current === my && cursorRef.current < source.frames.length) {
      const index = cursorRef.current;
      const frame = source.frames[index];
      if (!frame) break;
      const from = index === 0 ? source.initialState : (source.frames[index - 1]?.state ?? source.initialState);
      const controller = new AbortController();
      abortRef.current = controller;
      let result: "done" | "aborted";
      try {
        result = await playFrames({
          frames: [frame],
          state: from,
          signal: controller.signal,
          getSpeed: () => speedRef.current,
          getReduced: () => reducedRef.current,
          getArena: () => arenaRef.current,
          onState: setState,
          onBanner: setBannerTurn,
          onLog: (line) => setLines((current) => [...current, { ...line, id: `replay:${index}:${current.length}` }]),
        });
      } catch {
        if (run.current === my) setPlaying(false);
        return;
      }
      if (run.current !== my) return;
      paint(index + 1, source);
      if (result === "aborted") break;
    }
    if (run.current === my) setPlaying(false);
  }, [paint]);

  useEffect(() => {
    function onHide() {
      if (document.hidden) stop();
    }
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  const stepTurn = (direction: 1 | -1) => {
    const source = replayRef.current;
    if (!source) return;
    const index = cursorRef.current;
    const turn = index === 0 ? 0 : (source.frames[index - 1]?.state.turn ?? 0);
    if (direction < 0) {
      seek(turn <= 0 ? 0 : endCursorForTurn(source.frames, turn - 1));
      return;
    }
    let probe = index;
    while (probe < source.frames.length && (source.frames[probe]?.state.turn ?? 0) <= turn) probe += 1;
    if (probe >= source.frames.length) {
      seek(source.frames.length);
      return;
    }
    seek(endCursorForTurn(source.frames, source.frames[probe]?.state.turn ?? turn + 1));
  };

  if (error) {
    return (
      <div className="px-4 py-8">
        <ErrorState title="Repetición no disponible" body={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!replay || !state) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const maxTurn = replay.frames.reduce((max, frame) => Math.max(max, frame.state.turn), 0);

  return (
    <>
      <SpriteWarmup state={state} />
      <BattleStage
        state={state}
        background={replay.background}
        bannerTurn={bannerTurn}
        arenaRef={arenaRef}
        lines={lines}
        top={<FieldBar state={state} />}
        bottom={
          <div className="flex flex-col gap-3 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <GameButton type="button" variant="secondary" onClick={() => stepTurn(-1)} disabled={cursor === 0}>
                Anterior
              </GameButton>
              <GameButton type="button" onClick={() => (playing ? stop() : void play())}>
                {playing ? "Pausa" : "Reproducir"}
              </GameButton>
              <GameButton type="button" variant="secondary" onClick={() => stepTurn(1)} disabled={cursor >= replay.frames.length}>
                Siguiente
              </GameButton>
              <GameButton type="button" variant="ghost" onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))} aria-label={`Velocidad ${speed}×`}>
                {speed}×
              </GameButton>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <span className="font-display uppercase tracking-wide text-text-dim">Turno {state.turn}</span>
              <input
                type="range"
                min={0}
                max={Math.max(maxTurn, 0)}
                value={Math.min(state.turn, maxTurn)}
                aria-label="Turno de la repetición"
                onChange={(event) => seek(endCursorForTurn(replay.frames, Number(event.target.value)))}
                className="h-11 flex-1 accent-accent"
              />
            </label>
            <Link href="/history" className="font-display inline-flex min-h-11 items-center text-sm font-semibold uppercase text-accent-2">
              Volver al historial
            </Link>
          </div>
        }
      />
    </>
  );
}
