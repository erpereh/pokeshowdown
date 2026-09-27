"use client";

import type { MoveSummary, SpeciesDetail } from "@/shared/contract";
import { useEffect, useRef, useState } from "react";
import { isAbort, resolveSpecies } from "./api";
import { toSpeciesId } from "./model";

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export interface SpeciesBundle {
  species: SpeciesDetail;
  moves: MoveSummary[];
}

export type BundleStatus = "idle" | "loading" | "ready" | "error";

export function useSpeciesCache(names: readonly string[]) {
  const cache = useRef(new Map<string, SpeciesBundle>());
  const inflight = useRef(new Set<string>());
  const namesRef = useRef(names);
  namesRef.current = names;
  const mounted = useRef(true);
  const [status, setStatus] = useState<Record<string, BundleStatus>>({});
  const [nonce, setNonce] = useState(0);
  const speciesKey = names.filter(Boolean).map((name) => toSpeciesId(name)).join("|");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const wanted = speciesKey ? speciesKey.split("|") : [];
    setStatus((current) => {
      const next = { ...current };
      for (const id of wanted) {
        if (cache.current.has(id)) next[id] = "ready";
      }
      return next;
    });
    for (const name of namesRef.current) {
      if (!name.trim()) continue;
      const id = toSpeciesId(name);
      if (!id || cache.current.has(id) || inflight.current.has(id)) continue;
      inflight.current.add(id);
      setStatus((current) => ({ ...current, [id]: "loading" }));
      void resolveSpecies(name)
        .then((bundle) => {
          cache.current.set(id, bundle);
          cache.current.set(bundle.species.id, bundle);
          cache.current.set(toSpeciesId(bundle.species.name), bundle);
          if (!mounted.current) return;
          setStatus((current) => ({
            ...current,
            [id]: "ready",
            [bundle.species.id]: "ready",
            [toSpeciesId(bundle.species.name)]: "ready",
          }));
        })
        .catch((error: unknown) => {
          if (isAbort(error) || !mounted.current) return;
          setStatus((current) => ({ ...current, [id]: "error" }));
        })
        .finally(() => {
          inflight.current.delete(id);
        });
    }
  }, [speciesKey, nonce]);

  function remember(bundle: SpeciesBundle) {
    cache.current.set(bundle.species.id, bundle);
    cache.current.set(toSpeciesId(bundle.species.name), bundle);
    setStatus((current) => ({
      ...current,
      [bundle.species.id]: "ready",
      [toSpeciesId(bundle.species.name)]: "ready",
    }));
  }

  function retry(name: string) {
    const id = toSpeciesId(name);
    cache.current.delete(id);
    inflight.current.delete(id);
    setStatus((current) => ({ ...current, [id]: "idle" }));
    setNonce((value) => value + 1);
  }

  function get(name: string): SpeciesBundle | null {
    if (!name.trim()) return null;
    return cache.current.get(toSpeciesId(name)) ?? cache.current.get(name.trim().toLowerCase()) ?? null;
  }

  function statusFor(name: string): BundleStatus {
    if (!name.trim()) return "idle";
    return status[toSpeciesId(name)] ?? "idle";
  }

  return { get, statusFor, remember, retry };
}
