# Assets y sincronización

Showdown es la fuente principal; PokéAPI Sprites es fallback del perfil full. No se añaden fuentes. Las rutas public/assets/generated son locales y se regeneran; source indica procedencia.

## Perfil runtime

El build Vercel y la instalación local usan pnpm sync:assets --profile=runtime.

- Sprites ani/ani-back y gen5/gen5-back, con gen5 shiny en ambas orientaciones. Solo IDs relevantes para Gen 9, formas y alternativas.
- Hoja itemicons-sheet.png, tipos/typeicons, fondos gen6bgs, sustitutos gen5 y efectos de combate.
- runtime-index.json compacto: variantes disponibles, tamaños de frame, fondos, tipos y FX. El frontend consulta este índice, no el manifest completo.
- Shiny animado se usa si existe una sincronización full; runtime conserva fallback estático shiny. Reduced motion usa variantes estáticas.
- El mirror de Vercel vive en .next/cache/showdown-assets; el public publicado incluye únicamente lo requerido por el perfil, con copias reales mediante copyFile y sin hardlinks. Localmente, si mirror y destino difieren, se conservan hardlinks con fallback a copia.

Medición del perfil runtime en esta entrega: 6.054 archivos, 162.126.402 bytes; 998 IDs en runtime-index, 19 fondos, 82 efectos y 40 imágenes de tipo. Sin fallos de descarga, no disponibles, huérfanos ni archivos ausentes. El manifest registra 1.417 especies del Dex; la cobertura de generaciones fuera del perfil no describe un fallo del MVP.

## Perfil full opcional

pnpm sync:assets --profile=full descarga ani con shiny, gen1–gen6, HOME, iconos, objetos, entrenadores, sustitutos, fondos y FX. PokéAPI solo cubre formas base sin GIF/HOME de Showdown. No es necesario para jugar Gen 9.

Se excluyen afd/digimon/dex, paletas de juegos, entrenadores custom y chrome ajeno al combate. MP4 se omite cuando existe WEBM. Tipos ??? se guardan como unknown.png; colisiones por mayúsculas usan __alt, compatible Windows/Linux.

## Pipeline y verificación

sync compara índices remotos, fechas/tamaños y sync-state.jsonl; omite coincidencias y reintenta fallos. Produce manifest.json y runtime-index.json. audit:assets compara manifest/disco, cobertura, huérfanos y hashes; falla por errores de descarga o archivos ausentes.

Binarios y reportes generados están ignorados por Git. La ausencia de una variante admite fallback local sin impedir la simulación. El índice solo cachea cargas correctas: tras fallo de red se puede reintentar al volver conectividad/visibilidad.

Playwright comprueba imágenes cargadas, requests de assets, consola y overflow con desktop/móvil. Las capturas se generan en artefactos ignorados y son evidencias de la revisión visual.

Fuentes: [Showdown sprites](https://play.pokemonshowdown.com/sprites/) · [Showdown FX](https://play.pokemonshowdown.com/fx/) · [PokéAPI Sprites](https://github.com/PokeAPI/sprites).
