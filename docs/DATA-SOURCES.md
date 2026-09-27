# Fuentes de datos

## Autoridad

**Pokémon Showdown es la única autoridad competitiva**, fijada a la misma versión del motor de battle. PokéAPI aporta únicamente metadatos de Pokédex no necesarios para resolver turnos. En conflicto competitivo prevalece Showdown.

| Fuente / API | Qué proporciona |
| --- | --- |
| Showdown `Dex` | Especies/formas, stats, tipos, movimientos, habilidades, objetos, naturalezas, condiciones, type chart y mods por generación. |
| Showdown `TeamValidator` | Legalidad, learnsets, bans, clauses y reglas del formato. |
| Showdown `Teams` | Importación, exportación, packing y generación de equipos cuando aplique. |
| Showdown `BattleStream` | Simulación, turnos, RNG y resultado. |
| Showdown Formats/Random Battles | Formatos, rulesets y sets aleatorios. |
| PokéAPI | Evoluciones, número de Pokédex, flavor text, species metadata, traducciones y otros complementos. |

Fuentes: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) · [PokéAPI](https://pokeapi.co/).

## Integración

- Los datos competitivos deben corresponder a la **versión fijada del motor**; guardar `engine_version` en partidas/replays y cuando corresponda en equipos.
- Normalizar IDs internamente, priorizando el ID de Showdown y mapeando el ID de PokéAPI solo si hace falta.
- PokéAPI nunca es requisito para iniciar/resolver batalla, validar equipo o generar Random Battle. Ante fallo de PokéAPI, la funcionalidad competitiva continúa.
- El motor instalado está fijado en `pokemon-showdown@0.11.11`. El adaptador server-only vive en `src/server/showdown/`.
- El complemento descargado es solo nombres y genus en español, más el nombre de forma, en `data/complement/es.json`. Se regenera con `pnpm sync:data` a partir de `pokemon_species_names.csv`, `pokemon_form_names.csv` y `pokemon_forms.csv` (este último solo como enlace entre id e identifier). No se copian movimientos, habilidades, objetos, learnsets ni stats.
- `src/server/pokemon-data/` lee ese JSON local. Si el archivo no está, la consulta devuelve null y el simulador sigue disponible.
- Sincronizaciones deterministas y versionadas; caché para metadatos estáticos, no para el estado autoritativo de partidas activas.
- No duplicar manualmente fórmulas, learnsets, bans, clauses, prioridades, estados o interacciones entre items/abilities.
- Los archivos de sprites siguen un pipeline diferente descrito en [ASSET-INVENTORY.md](ASSET-INVENTORY.md).
