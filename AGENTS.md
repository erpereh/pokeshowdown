# AGENTS.md

## Objetivo

Este archivo define como debe trabajar la IA dentro de este proyecto.

## Flujo de trabajo

Antes de modificar codigo:

1. Entender exactamente el cambio solicitado.
2. Revisar el codigo existente relacionado.
3. Leer solo la documentacion relevante.
4. Modificar unicamente lo necesario.
5. Mantener las decisiones arquitectonicas fijadas.
6. Validar el resultado antes de finalizar.

## Carga de contexto

- Leer `docs/PRODUCT.md` para funcionalidad, alcance y reglas de producto.
- Leer `docs/ARCHITECTURE.md` para Vercel, Supabase, persistencia, Realtime o battle engine.
- Leer `docs/DESIGN.md` para UI/UX.
- Leer `docs/DATA-SOURCES.md` para datos Pokemon, formatos, reglas e IDs.
- Leer `docs/ASSET-INVENTORY.md` para sprites, artwork, iconos, fondos y pipeline de assets.
- Para cambios pequenos y aislados, revisar directamente el codigo relacionado.

## Reglas generales

- Reutilizar codigo existente antes de crear abstracciones nuevas.
- No modificar funcionalidad no relacionada.
- No duplicar logica.
- Evitar sobreingenieria.
- No introducir infraestructura no necesaria.
- No implementar funcionalidades fuera de `docs/PRODUCT.md` sin solicitud explicita.
- Mantener documentacion y codigo coherentes.

## Decisiones fijas

Estas decisiones no deben cambiarse sin instruccion explicita del usuario.

### Infraestructura

- El proyecto se despliega en Vercel.
- No existe backend persistente propio.
- No introducir infraestructura persistente adicional para el flujo actual.
- El backend de juego se implementa con Vercel Functions / Next.js Route Handlers.
- Las funciones que usan Pokemon Showdown deben usar runtime Node.js, no Edge.
- Fijar una version de Node compatible con la version fijada de Pokemon Showdown.

### Supabase

- Supabase es la plataforma de Auth, PostgreSQL, persistencia y Realtime.
- Usar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en cliente.
- Usar `SUPABASE_SECRET_KEY` solo en backend controlado.
- Nunca exponer `SUPABASE_SECRET_KEY` al navegador.
- Usar RLS en todas las tablas expuestas con datos de usuario.
- No basar autorizacion en metadata editable por el usuario.
- Realtime Broadcast se utiliza para notificar actualizaciones de Private Battle.
- Los canales de battles privadas deben ser privados/autorizados.
- No exponer decisiones pendientes de un jugador al rival.

### Pokemon Showdown

- Pokemon Showdown es la autoridad de mecanicas, RNG, formatos y legalidad.
- La API oficial del simulador es Node-only; no ejecutar el paquete oficial en componentes de navegador.
- Encapsular Showdown en una capa `battle-engine`.
- El frontend no debe conocer el protocolo textual interno de Showdown.
- Usar `TeamValidator` para legalidad.
- Usar `Teams` para import/export/packing.
- Usar `Dex` para datos competitivos.
- Usar `BattleStream` para simulacion.
- Random Battle se genera mediante Showdown.
- No reimplementar reglas que ya resuelve Showdown.
- Fijar la version exacta del motor y registrar `engine_version` en battles/replays.

### Single Player

- Single Player se resuelve en Vercel Functions.
- La CPU se ejecuta server-side.
- Cada turno resuelto debe persistirse antes de considerarse confirmado.
- Guardar suficiente informacion canonica para reconstruir la battle.
- Una partida activa debe poder reanudarse despues de cerrar navegador o cambiar dispositivo.
- La CPU debe recibir una vista de decision apropiada y no depender accidentalmente de informacion oculta no destinada a su estrategia.

### Private Battle

- Solo existen dos jugadores.
- Las salas se crean mediante codigo/enlace privado.
- Ningun navegador actua como host autoritativo.
- Cada eleccion se envia a Vercel y se persiste de forma privada.
- El rival no puede leer una eleccion pendiente.
- Cuando llegan ambas elecciones, resolver el turno una sola vez.
- La resolucion debe ser atomica/idempotente ante peticiones concurrentes o repetidas.
- Persistir el resultado antes de emitir la actualizacion Realtime.
- Realtime solo distribuye eventos/vistas permitidas; no sustituye la resolucion autoritativa.

### Modos actuales

El alcance actual contiene unicamente:

1. Single Player contra CPU.
2. Private Battle 1v1 entre dos amigos.

No añadir otros modos online salvo solicitud explicita.

### Data sources

Prioridad:

1. Pokemon Showdown para datos competitivos, reglas y mecanicas.
2. PokeAPI solo para informacion complementaria de Pokedex.
3. Ante conflicto competitivo, gana Pokemon Showdown.

No duplicar manualmente learnsets, bans, clauses, formulas de dano, prioridades, status mechanics ni interacciones de items/abilities.

### Assets

- Fuente principal: assets de Pokemon Showdown.
- Fallback: PokeAPI Sprites.
- Sincronizar assets mediante scripts.
- No introducir hotlinks directamente en componentes.

## Persistencia de battle

La reconstruccion debe basarse en datos canonicos, no en estado UI.

Como minimo conservar cuando aplique:

- battle id;
- mode;
- format id;
- engine version;
- seed;
- equipos/snapshots necesarios;
- input log canonico;
- turno actual;
- status;
- timestamps.

No guardar animaciones o estado puramente visual como fuente de verdad.

## Variables de entorno

El contrato actual es:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

No añadir variables "por si acaso".

## Fuentes de verdad

- `docs/PRODUCT.md`: producto y alcance.
- `docs/ARCHITECTURE.md`: arquitectura.
- `docs/DESIGN.md`: UI/UX.
- `docs/DATA-SOURCES.md`: datos.
- `docs/ASSET-INVENTORY.md`: assets.
- El codigo representa la implementacion real.

## Idioma

- Documentacion en espanol.
- Identificadores de codigo en ingles.
- Mantener nombres oficiales de tecnologias/APIs.

## Validacion

Antes de finalizar:

- revisar archivos modificados;
- comprobar que no hay infraestructura obsoleta;
- ejecutar typecheck/lint/build/tests relevantes;
- validar autorizacion y RLS si se toca Supabase;
- validar idempotencia si se toca resolucion de turnos;
- validar que no se filtra informacion privada;
- comprobar que la documentacion sigue representando la implementacion.
