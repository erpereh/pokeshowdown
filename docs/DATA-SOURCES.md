# Fuentes de datos

Este documento define **de dónde procede cada tipo de dato y qué fuente tiene prioridad**.

Fecha de última verificación documental: **2026-09-26**.

## Principio general

No existe una única fuente para todo.

La aplicación separa:

1. **mecánicas y legalidad**;
2. **datos competitivos**;
3. **metadatos de presentación**;
4. **assets**.

Una fuente auxiliar nunca puede sobreescribir silenciosamente al motor en una decisión de combate.

## Prioridad

| Dominio | Fuente de verdad |
| --- | --- |
| Resultado del combate | Pokémon Showdown engine |
| Legalidad del equipo | Pokémon Showdown `TeamValidator` |
| Import/export de equipo | Pokémon Showdown `Teams` |
| Formatos/reglas | versión fijada de Pokémon Showdown |
| Stats/tipos/moves usados por motor | `Dex` de la versión fijada |
| Random teams | motor/generador de Pokémon Showdown |
| Datos puramente presentacionales | dataset interno normalizado |
| Assets | manifiesto interno + `ASSET-INVENTORY.md` |

## Pokémon Showdown

Repositorio oficial:

https://github.com/smogon/pokemon-showdown

### Qué aporta

El repositorio oficial se describe como:

- simulador de battles;
- librería JavaScript para simulación y datos de Pokédex;
- herramientas de línea de comandos;
- game server.

A fecha de verificación declara soporte de simulación para generaciones 1 a 9.

### APIs que nos interesan

- `BattleStream`
- `Dex`
- `Teams`
- `TeamValidator`

Documentación relevante:

- https://github.com/smogon/pokemon-showdown/blob/master/sim/SIMULATOR.md
- https://github.com/smogon/pokemon-showdown/blob/master/sim/TEAMS.md
- https://github.com/smogon/pokemon-showdown/blob/master/PROTOCOL.md
- https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md

### Licencia

El servidor/motor se distribuye bajo MIT.

La versión del motor debe fijarse en lockfile y registrarse también en battles/replays cuando afecte a reproducibilidad.

## Cliente oficial de Pokémon Showdown

Repositorio:

https://github.com/smogon/pokemon-showdown-client

No se usará como base de nuestro frontend.

Motivos:

- queremos una arquitectura/UI propia;
- el cliente oficial se distribuye bajo AGPLv3, distinta de la licencia del servidor;
- evitar acoplar nuestro producto a su estado/UI/protocolo interno más de lo necesario.

Puede consultarse como documentación de comportamiento/protocolo, pero no se copiará código sin revisar previamente obligaciones de licencia.

## PokéAPI

Web:

https://pokeapi.co/

Uso previsto: **complementario**, no autoridad de combate.

Puede ser útil para:

- nombres/metadatos;
- cadenas evolutivas;
- flavor/presentation data;
- referencias de sprites;
- enriquecer una Pokédex.

Reglas:

- la aplicación no debe requerir una petición a PokéAPI para resolver un turno;
- los datos necesarios en runtime se sincronizarán/normalizarán cuando sea razonable;
- conflictos con la versión del motor se resuelven a favor del motor para funcionalidad competitiva.

## Assets

Las fuentes visuales se documentan por separado en `ASSET-INVENTORY.md`.

Importante: licencia del código de un repositorio, licencia declarada del repositorio y copyright de los archivos gráficos pueden ser cosas distintas.

## Normalización interna

No queremos que componentes React conozcan IDs específicos de varias fuentes.

Crear una capa interna con IDs estables.

Ejemplo conceptual:

```ts
type SpeciesRecord = {
  id: string;          // canonical internal id
  showdownId: string;
  pokeApiId?: number;
  displayName: string;
  types: string[];
};
```

Los adapters convierten datos externos a modelos propios.

## Sincronización

Los scripts de sincronización deben:

1. usar una versión/tag/commit identificable;
2. validar schema;
3. producir salida determinista;
4. registrar procedencia;
5. generar diff/reporte;
6. fallar ante inconsistencias críticas;
7. no publicar automáticamente cambios sin revisión.

## Datos que NO deben duplicarse manualmente

Evitar mantener listas manuales paralelas de:

- movimientos legales;
- learnsets;
- bans;
- clauses;
- fórmulas de daño;
- prioridades;
- reglas de estados;
- interacciones de abilities/items;
- mecánicas por generación.

La UI puede tener datos derivados para presentación, pero nunca otra implementación autoritativa de estas reglas.

## Caché

Los datos estáticos se pueden cachear agresivamente si incluyen versión.

Los datos de battle activos no se cachean en CDN como fuente de verdad.

## Fallbacks

Si una fuente presentacional auxiliar falla:

- Team Builder debe seguir pudiendo operar con datos esenciales del motor;
- una battle en curso no debe verse afectada;
- la UI puede degradar artwork/flavor text;
- nunca cambiar reglas para “adaptarse” a un dato faltante.

## Checklist al añadir una fuente

- [ ] Qué problema resuelve.
- [ ] Es realmente necesaria.
- [ ] Qué campos consumimos.
- [ ] Cuál es su licencia.
- [ ] Qué derechos tienen sus assets.
- [ ] Cómo versionamos.
- [ ] Qué ocurre si cae.
- [ ] Cómo se actualiza.
- [ ] Qué fuente gana ante conflicto.
- [ ] Existe test/validación del adaptador.
