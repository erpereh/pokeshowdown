"use client";

import { useEffect, useState } from "react";
import type { ChallengeConfig } from "@/shared/contract";
import { formatName } from "@/client/ui/format.ts";
import { pushToast } from "@/client/ui/Toast.tsx";
import { serverNow } from "./store.ts";

/** Re-renders every `ms` and returns the approximated server clock. */
export function useServerClock(ms = 1000): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

export function secondsLeft(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function timerLabel(timer: ChallengeConfig["timerSeconds"]): string {
  return timer === null ? "Sin límite" : `${timer} s por decisión`;
}

export function configSummary(config: ChallengeConfig): string {
  const parts = [formatName(config.formatId), timerLabel(config.timerSeconds)];
  if (config.formatId === "gen9ou") parts.push(config.ouTeamSource === "saved" ? "Equipos guardados" : "Guardado o aleatorio");
  return parts.join(" · ");
}

export function formatFriendCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export async function copyFriendCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    pushToast("Código de amigo copiado.");
  } catch {
    pushToast(`Tu código es ${formatFriendCode(code)}`);
  }
}
