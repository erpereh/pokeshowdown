"use client";

import { ASSET_BASE, fxUrl, useRuntimeIndex } from "@/client/sprites/runtime-index";
import { pseudoOverlayFile, terrainOverlayFile, weatherOverlayFile } from "@/client/battle/fx/catalog";
import { useReducedMotion } from "@/client/battle/fx/useReducedMotion";
import "@/client/battle/fx/fx.css";

export interface WeatherOverlayProps {
  weather: string | null;
  terrain: string | null;
  pseudoWeather: string[];
}

interface Layer {
  file: string;
  opacity: number;
}

function layerUrl(index: ReturnType<typeof useRuntimeIndex>, file: string): string | null {
  if (!index) return `${ASSET_BASE}/fx/${file}`;
  return fxUrl(index, file);
}

export function WeatherOverlay({ weather, terrain, pseudoWeather }: WeatherOverlayProps) {
  const reduced = useReducedMotion();
  const index = useRuntimeIndex();
  const layers: Layer[] = [];
  const weatherFile = weatherOverlayFile(weather);
  const terrainFile = terrainOverlayFile(terrain);
  if (weatherFile) layers.push({ file: weatherFile, opacity: 0.24 });
  if (terrainFile) layers.push({ file: terrainFile, opacity: 0.28 });
  for (const name of pseudoWeather) {
    const file = pseudoOverlayFile(name);
    if (file) layers.push({ file, opacity: 0.22 });
  }

  return (
    <div className="fx-weather-root" aria-hidden="true">
      {layers.map((layer) => {
        const url = layerUrl(index, layer.file);
        if (!url) return null;
        return (
          <div
            key={layer.file}
            className={reduced ? "fx-weather-layer is-static" : "fx-weather-layer"}
            style={{ backgroundImage: `url("${url}")`, opacity: layer.opacity }}
          />
        );
      })}
    </div>
  );
}
