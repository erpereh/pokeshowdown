"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion";
import { POKEBALL_PLACEHOLDER_URL } from "@/client/sprites/runtime-index";
import { useSpriteChain } from "@/client/sprites/use-sprite-chain";
import "@/client/battle/fx/fx.css";

export interface PokemonSpriteProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  spriteId: string;
  facing: "front" | "back";
  shiny?: boolean;
  gender?: "M" | "F" | "N";
  /** Defaults to true (animated gif, then static fallbacks). */
  animated?: boolean;
  /** Multiplier on the index frame size. Defaults to 1. */
  scale?: number;
  alt: string;
}

export const PokemonSprite = forwardRef<HTMLDivElement, PokemonSpriteProps>(function PokemonSprite(
  { spriteId, facing, shiny = false, gender, animated = true, scale = 1, className, alt, style, ...rest },
  ref,
) {
  const reduced = useReducedMotion();
  const chain = useSpriteChain({ spriteId, facing, shiny, gender, animated });
  const width = Math.max(1, Math.round(chain.width * scale));
  const height = Math.max(1, Math.round(chain.height * scale));
  const staticShiny = shiny && !chain.src?.endsWith(".gif");
  const classes = ["fx-sprite", staticShiny ? "fx-shiny" : "", staticShiny && reduced ? "is-static" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} {...rest} className={classes} style={{ ...style, width, height }}>
      {chain.src ? (
        <img
          src={chain.src}
          alt={alt}
          decoding="async"
          draggable={false}
          className={`fx-sprite-img${chain.src.endsWith(".png") ? " pixelated" : ""}`}
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
    </div>
  );
});
