"use client";

import { useSyncExternalStore } from "react";

/** localStorage values `1` / `true` force reduced motion; `0` / `false` force full motion. */
export const REDUCED_MOTION_STORAGE_KEY = "ps-reduced-motion";

function readOverride(): boolean | null {
  try {
    const value = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
  } catch {
    return null;
  }
  return null;
}

export function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const override = readOverride();
  if (override !== null) return override;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readReducedMotion, () => false);
}
