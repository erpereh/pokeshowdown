# Fuentes de datos

Este documento fija de dónde procede cada tipo de dato y qué fuente tiene prioridad.

## Regla general

**Pokémon Showdown es la fuente principal y autoritativa para todo lo relacionado con combate, legalidad y datos competitivos.**

**PokéAPI es únicamente una fuente complementaria para información de Pokédex que no interviene en la resolución del combate.**

Ante cualquier conflicto funcional entre ambas, gana Pokémon Showdown.

## Matriz definitiva

| Información | Fuente |
| --- | --- |
| Especies y formas competitivas | Pokémon Showdown `Dex` |
| Stats base | Pokémon Showdown `Dex` |
| Tipos | Pokémon Showdown `Dex` |
| Movimientos | Pokémon Showdown `Dex` |
| Habilidades | Pokémon Showdown `Dex` |
| Objetos | Pokémon Showdown `Dex` |
| Naturalezas | Pokémon Showdown `Dex` |
| Learnsets | Pokémon Showdown |
| Type chart | Pokémon Showdown |
| Formatos | Pokémon Showdown |
| Rulesets | Pokémon Showdown |
| Clauses | Pokémon Showdown |
| Bans | Pokémon Showdown |
| Legalidad de equipos | Pokémon Showdown `TeamValidator` |
| Import/export/packing | Pokémon Showdown `Teams` |
| Random Battles | Pokémon Showdown |
| Resolución de battle | Pokémon Showdown `BattleStream` |
| Mecánicas por generación | Pokémon Showdown mods Gen 1–9 |
| Evoluciones | PokéAPI, complemento |
| Número Pokédex | PokéAPI, complemento |
| Flavor text/descripciones | PokéAPI, complemento |
| Species metadata | PokéAPI, complemento |
| Localizaciones/nombres | PokéAPI, complemento |
| Assets | ver `ASSET-INVENTORY.md` |

## Pokémon Showdown

Repositorio:

https://github.com/smogon/pokemon-showdown

### APIs principales

- `BattleStream`
- `Dex`
- `Teams`
- `TeamValidator`

### Qué debe salir de Showdown

La aplicación debe utilizar Showdown para:

- Pokedex competitiva;
- Moves;
- Abilities;
- Items;
- Natures;
- Learnsets;
- Conditions;
- TypeChart;
- Formats;
- Rulesets;
- FormatsData;
- datos/mods por generación;
- legalidad;
- equipos;
- Random Battles;
- simulación.

No crear una segunda implementación de estas reglas.

## PokéAPI

https://pokeapi.co/

Uso: enriquecer presentación/Pokédex.

Ejemplos:

- evolution chains;
- species metadata;
- flavor text;
- capture rate;
- habitat cuando exista;
- datos de género/especie;
- números/relaciones Pokédex;
- traducciones o nombres adicionales.

### Regla crítica

Una petición a PokéAPI nunca debe ser necesaria para:

- iniciar una battle;
- calcular un turno;
- validar un equipo;
- resolver un movimiento;
- generar un Random Team.

El juego debe seguir funcionando competitivamente aunque PokéAPI no esté disponible.

## Normalización de IDs

El ID interno base debe favorecer compatibilidad con Showdown.

Ejemplo conceptual:

```ts
type SpeciesRecord = {
  id: string;
  showdownId: string;
  pokeApiId?: number;
  displayName: string;
};
```

Mantener una tabla/adapter explícito solo cuando los IDs difieran.

No usar nombres visuales como clave técnica si existe un ID estable.

## Sincronización

### Datos Showdown

Preferir lectura desde la misma versión del paquete/motor fijada en el proyecto.

Esto evita que:

- el Team Builder use datos de una versión;
- el motor ejecute otra;
- los formatos se desincronicen.

### PokéAPI

Los datos complementarios pueden:

- consultarse con caché;
- sincronizarse a un dataset local;
- persistirse si aporta valor.

No es necesario copiar toda PokéAPI.

## Versionado

Registrar la versión/commit del motor usado en:

- battles;
- replays;
- equipos cuando sea relevante para validación histórica.

Los datos competitivos no deben actualizarse independientemente del motor sin motivo.

## Caché

Se puede cachear:

- Pokédex;
- moves;
- abilities;
- items;
- species metadata;
- datos complementarios de PokéAPI.

No usar una caché externa como autoridad de estado de una battle activa.

## Fallbacks

Si PokéAPI falla:

- ocultar/degradar datos de presentación no esenciales;
- mantener Team Builder funcional con Showdown;
- mantener battles completamente funcionales.

Si falta un dato competitivo esperado de Showdown:

- tratarlo como error/incompatibilidad;
- no inventar el dato desde otra fuente.

## Prohibido duplicar manualmente

- learnsets;
- bans;
- clauses;
- fórmulas de daño;
- prioridades;
- status mechanics;
- interacciones de items;
- interacciones de abilities;
- reglas específicas por generación.

La UI puede derivar datos para presentación, pero no convertirse en autoridad paralela.

## Assets

Los datos y los assets son pipelines diferentes.

Consultar `ASSET-INVENTORY.md`.
