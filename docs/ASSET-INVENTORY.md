# Fuentes y sincronización de assets

Este archivo **solo fija fuentes y pipeline técnico**; no decide interfaz, estética, layout ni componentes. Proyecto personal de uso propio.

## Origen

- **Principal:** [Pokémon Showdown](https://play.pokemonshowdown.com/sprites/) (IDs alineados con el `Dex`).
- **Fallback:** [PokéAPI Sprites](https://github.com/PokeAPI/sprites) cuando falte una variante concreta.
- No añadir fuentes adicionales sin necesidad.

| Categoría | Rutas de Showdown |
| --- | --- |
| Combate | `ani/`, `ani-back/`, `ani-shiny/`, `ani-back-shiny/`, `gen*/` |
| Artwork | `home/`, `home-centered/`, `home-shiny/` |
| Otros | iconos/spritesheets Pokémon, `itemicons/`, `types/`, `typeicons/`, `trainers/`, `substitutes/`, `misc/` |
| Entorno/efectos | `gen6bgs/`, `/fx/` |

## Pipeline

- `pnpm sync:assets`: lee el índice `?view=dir` de cada directorio permitido, compara fecha y tamaño con `sync-state.jsonl`, omite lo ya descargado y reintenta fallos de red. Escribe `public/assets/generated/manifest.json`.
- `pnpm audit:assets`: cobertura por especie y forma base, archivos del manifest que no están en disco, huérfanos, y grupos con el mismo SHA-256. El informe queda en `public/assets/generated/audit.json`.
- Los binarios viven en `public/assets/generated/` y Git los ignora. Los recursos propios, cuando existan, irán en `public/assets/custom/`.
- Las rutas del manifest son locales (`/assets/generated/...`). El campo `source` solo indica la procedencia (`showdown` o `pokeapi`).
- La ausencia de un sprite no impide una batalla. El fallback remoto de PokéAPI solo se usa al sincronizar, para formas base a las que les falta el GIF o el HOME en Showdown.
- Un build de Vercel ejecuta `pnpm sync:assets` y publica `public/`. El árbol no viaja en el repositorio. En el plan Hobby la salida de un build de Git no tiene el tope de 100 MB que aplica a la subida de fuentes por CLI. Los sprites no entran en el bundle de la Function (límite 250 MB sin comprimir).

Directorios descargados: `ani`, `ani-back`, `ani-shiny`, `ani-back-shiny`; `gen1`–`gen5` con back y shiny cuando existen; `gen6` y `gen6-back`; `home`, `home-centered`, `home-shiny`, `home-centered-shiny`; hojas `pokemonicons-sheet.png`, `pokemonicons-pokeball-sheet.png` e `itemicons-sheet.png`; `itemicons/`, `types/`, `typeicons/`, `trainers/`, `substitutes/`, `gen6bgs/` (solo `.jpg` si también hay `.png`) y efectos de combate en `/fx/` (sin chrome del sitio ni `.mp4` cuando ya hay `.webm`).

No se descargan `afd`, `digimon`, `dex`, paletas de juego (`gen1rb`, `gen3rs`, `gen4dp` y equivalentes), `gen5ani`, `trainers-custom` ni hojas de iconos antiguas.

El tipo `???` se guarda como `sprites/types/unknown.png` porque `?` no es válido en Windows ni en una ruta URL. Si el servidor tiene dos archivos que solo se distinguen por mayúsculas (`unown-l.gif` y `unown-L.gif`), el segundo se guarda con el sufijo `__alt` para que el manifest sea el mismo en Windows y en Linux.

`gen6-back/` contiene props de Pokéstar, no espaldas de especie: los archivos están en disco y la cobertura por especie de esa variante es 0.

## Medición

Sincronización comprobada con `pokemon-showdown@0.11.11`:

| Dato | Valor |
| --- | --- |
| Archivos en manifest y en disco | 28.444 |
| Tamaño | 741.273.274 bytes (707 MiB) |
| Especies Dex (`num > 0`) | 1.417, de ellas 1.025 formas base |
| HOME en formas base | 1.025/1.025 |
| Frente animado en formas base | 1.011/1.025 |
| Fallback PokéAPI | 14 archivos, solo formas base sin GIF o sin HOME en Showdown |
| Formas sin frente animado ni HOME | 15, todas alternativas (megas o cosméticas) |
| Huérfanos / archivos del manifest ausentes | 0 / 0 |
| Grupos con el mismo hash | 1.118 |
| No disponible en origen | `itemicons/kyurem-white.png` (respuesta vacía) |

Compartidos: 3 hojas de iconos, 580 objetos, 40 tipos, 19 iconos de tipo, 1.500 entrenadores, 8 sustitutos, 19 fondos y 123 efectos. Una segunda `pnpm sync:assets` terminó con `downloaded=0`.
