"use client";

import type { HTMLAttributes } from "react";
import { POKEBALL_PLACEHOLDER_URL } from "@/client/sprites/runtime-index";
import { useSpriteChain } from "@/client/sprites/use-sprite-chain";
import "@/client/battle/fx/fx.css";

export interface MiniSpriteProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  spriteId: string;
  shiny?: boolean;
  gender?: "M" | "F" | "N";
  /** Box size in px. Defaults to 48. */
  size?: number;
  alt: string;
  fainted?: boolean;
}

/** Static gen5 front sprite for lists, the switch panel, and the team builder. */
export function MiniSprite({ spriteId, shiny = false, gender, size = 48, alt, className, fainted = false, style, ...rest }: MiniSpriteProps) {
  const chain = useSpriteChain({ spriteId, facing: "front", shiny, gender, animated: false });
  const classes = ["fx-sprite", className ?? ""].filter(Boolean).join(" ");

  return (
    <span {...rest} className={classes} style={{ ...style, width: size, height: size }}>
      {chain.src ? (
        <img
          src={chain.src}
          alt={alt}
          decoding="async"
          draggable={false}
          className="fx-sprite-img pixelated"
          style={{ filter: fainted ? "grayscale(1)" : undefined, opacity: fainted ? 0.65 : 1 }}
          onError={chain.onError}
        />
      ) : null}
      {chain.ready && !chain.src && !chain.broken ? (
        <img
          src={POKEBALL_PLACEHOLDER_URL}
          alt={alt}
          decoding="async"
          draggable={false}
          className="fx-pokeball-placeholder"
          onError={chain.failPlaceholder}
        />
      ) : null}
      {chain.ready && !chain.src && chain.broken ? <span className="fx-silhouette" aria-hidden="true" /> : null}
    </span>
  );
}
