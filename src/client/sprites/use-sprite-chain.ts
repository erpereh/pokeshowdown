"use client";

import { useState } from "react";
import { resolveSpriteUrls, useRuntimeIndex, type SpriteResolveOptions } from "@/client/sprites/runtime-index";

interface ChainCursor {
  key: string;
  step: number;
  broken: boolean;
}

export function useSpriteChain(options: SpriteResolveOptions) {
  const index = useRuntimeIndex();
  const resolved = index
    ? resolveSpriteUrls(index, options)
    : { urls: [] as string[], width: 96, height: 96 };
  const chainKey = [
    options.spriteId,
    options.facing,
    options.shiny ? "1" : "0",
    options.gender ?? "",
    options.animated === false ? "0" : "1",
    resolved.urls.join("|"),
  ].join("\0");
  const [cursor, setCursor] = useState<ChainCursor>({ key: chainKey, step: 0, broken: false });
  if (cursor.key !== chainKey) setCursor({ key: chainKey, step: 0, broken: false });

  const step = cursor.key === chainKey ? cursor.step : 0;
  const broken = cursor.key === chainKey ? cursor.broken : false;
  const src = step < resolved.urls.length ? (resolved.urls[step] ?? null) : null;

  const onError = () => {
    setCursor((current) => {
      const base = current.key === chainKey ? current : { key: chainKey, step: 0, broken: false };
      if (base.step + 1 < resolved.urls.length) return { key: chainKey, step: base.step + 1, broken: false };
      return { key: chainKey, step: resolved.urls.length, broken: base.broken };
    });
  };

  const failPlaceholder = () => {
    setCursor({ key: chainKey, step: resolved.urls.length, broken: true });
  };

  return {
    ready: index !== null,
    src,
    width: resolved.width,
    height: resolved.height,
    broken,
    onError,
    failPlaceholder,
  };
}
