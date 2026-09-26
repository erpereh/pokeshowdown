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

## Pipeline futuro

- `pnpm sync:assets`: descargar, normalizar IDs de especies/formas, conservar transparencia, detectar duplicados, hashes, procedencia y manifest reproducible.
- `pnpm audit:assets`: comparar cobertura por especie/forma, front/back/shiny/icon, detectar faltantes/huérfanos y generar reporte.
- Archivos sincronizados en `public/assets/generated/` (ignorados por Git); los recursos propios, cuando existan, en `public/assets/custom/`.
- Los consumidores usarán rutas derivadas del manifest, no URLs externas incrustadas.
- Fallback por asset: variante exacta → forma base compatible → PokéAPI → icono → placeholder. Ausencia de asset nunca impide una battle.

El manifest incluirá origen/revisión, ID y rutas disponibles. Todavía **no existen scripts ni assets descargados**: lo anterior es el contrato para implementarlos posteriormente.
