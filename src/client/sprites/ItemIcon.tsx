"use client";

import { itemSpriteStyle } from "@/client/sprites/runtime-index";
import "@/client/battle/fx/fx.css";

export function ItemIcon({ spriteNum, name, size = 24 }: { spriteNum: number | null | undefined; name: string; size?: number }) {
  const icon = spriteNum == null ? null : itemSpriteStyle(spriteNum);
  const visible = icon !== null && icon.backgroundImage !== "none";
  const scale = size / 24;

  return (
    <span className="fx-item" role="img" aria-label={name} title={name} style={{ width: size, height: size }}>
      {visible && icon ? (
        <span
          className="pixelated"
          style={{
            ...icon,
            display: "block",
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      ) : null}
    </span>
  );
}
