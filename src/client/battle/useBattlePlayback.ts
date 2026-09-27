"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleFrame, PublicBattleState } from "@/shared/contract";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion.ts";
import { playFrames } from "./director.ts";
import { linesFromFrames, type LogLine } from "./log.ts";

interface Hydratable {
  frames: BattleFrame[];
  state: PublicBattleState;
}

export function useBattlePlayback() {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<PublicBattleState | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [bannerTurn, setBannerTurn] = useState<number | null>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<PublicBattleState | null>(null);
  const linesRef = useRef<LogLine[]>([]);
  const speedRef = useRef(speed);
  const reducedRef = useRef(reducedMotion);
  const abortRef = useRef<AbortController | null>(null);
  const token = useRef(0);
  const mounted = useRef(true);

  speedRef.current = speed;
  reducedRef.current = reducedMotion;

  const publishState = useCallback((next: PublicBattleState) => {
    stateRef.current = next;
    if (mounted.current) setState(next);
  }, []);

  const publishLines = useCallback((next: LogLine[]) => {
    linesRef.current = next;
    if (mounted.current) setLines(next);
  }, []);

  const hydrate = useCallback(
    (view: Hydratable) => {
      token.current += 1;
      abortRef.current?.abort();
      publishState(view.state);
      publishLines(linesFromFrames(view.frames));
      setPlaying(false);
      setBannerTurn(null);
    },
    [publishLines, publishState],
  );

  const playNew = useCallback(
    async (frames: BattleFrame[]) => {
      const start = stateRef.current;
      if (!start || frames.length === 0) return;
      const my = ++token.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const base = linesRef.current.slice();
      setPlaying(true);
      let seq = base.length;
      const result = await playFrames({
        frames,
        state: start,
        signal: controller.signal,
        getSpeed: () => speedRef.current,
        getReduced: () => reducedRef.current,
        getArena: () => arenaRef.current,
        onState: publishState,
        onBanner: (turn) => {
          if (mounted.current && token.current === my) setBannerTurn(turn);
        },
        onLog: (line) => {
          seq += 1;
          publishLines([...linesRef.current, { ...line, id: `live:${seq}:${line.kind}` }]);
        },
      });
      if (token.current !== my) return;
      const last = frames[frames.length - 1]?.state;
      if (result === "aborted" && last) {
        publishState(last);
        publishLines([...base, ...linesFromFrames(frames)]);
      } else if (last) {
        publishState(last);
      }
      setPlaying(false);
      setBannerTurn(null);
    },
    [publishLines, publishState],
  );

  const skip = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleSpeed = useCallback(() => {
    setSpeed((current) => (current === 1 ? 2 : 1));
  }, []);

  useEffect(() => {
    mounted.current = true;
    function onHide() {
      if (document.hidden) abortRef.current?.abort();
    }
    document.addEventListener("visibilitychange", onHide);
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return { state, lines, playing, speed, bannerTurn, arenaRef, hydrate, playNew, skip, toggleSpeed };
}
