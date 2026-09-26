# Roadmap

Este documento ordena el desarrollo. **No describe funcionalidad ya implementada.**

Para saber qué forma parte del producto consultar `PRODUCT.md`.

## Estado

**Fase actual: 0 — definición y documentación.**

## Fase 0 — Fundamentos

Objetivo: empezar a programar con decisiones coherentes.

- [x] Definir producto.
- [x] Definir arquitectura objetivo.
- [x] Definir dirección UI/UX.
- [x] Definir fuentes de datos.
- [x] Crear inventario/política de assets.
- [ ] Elegir nombre definitivo.
- [ ] Resolver estrategia legal inicial de sprites/assets para desarrollo y publicación.
- [ ] Inicializar monorepo.
- [ ] Fijar versiones de Node/pnpm.
- [ ] Configurar lint, format, typecheck y test.
- [ ] Configurar CI.

### Salida de fase

Repositorio inicializa localmente con un comando documentado y CI verifica el workspace.

## Fase 1 — Vertical slice local

Objetivo: demostrar que la integración del motor funciona antes de construir el producto alrededor.

- [ ] Integrar `pokemon-showdown`.
- [ ] Wrapper `battle-engine`.
- [ ] Crear battle Gen 9 Random local en backend.
- [ ] Parsear requests/eventos mínimos.
- [ ] UI de batalla mínima.
- [ ] Enviar decisiones desde navegador.
- [ ] Terminar una battle completa.
- [ ] Tests de integración del adaptador.

### No incluir todavía

- auth completa;
- ladder;
- matchmaking real;
- polish visual;
- todos los assets;
- todos los formatos.

### Salida de fase

Una battle Random completa puede jugarse desde la web contra un segundo cliente/control de prueba sin lógica de combate implementada por nosotros.

## Fase 2 — Multiplayer real

- [ ] Protocolo WebSocket versionado.
- [ ] Dos jugadores reales.
- [ ] autorización de battle;
- [ ] requests identificadas;
- [ ] decisiones idempotentes;
- [ ] desconexión;
- [ ] reconexión;
- [ ] timeout básico;
- [ ] persistencia mínima;
- [ ] E2E con dos browser contexts.

### Salida

Dos usuarios pueden completar una battle desde dispositivos/navegadores independientes y reconectarse sin corromper el estado.

## Fase 3 — Cuentas y Team Builder

- [ ] Supabase/PostgreSQL.
- [ ] Auth.
- [ ] Perfil básico.
- [ ] CRUD de equipos.
- [ ] search/selectors.
- [ ] EV/IV/natures/items/abilities/moves.
- [ ] import/export.
- [ ] `TeamValidator`.
- [ ] Gen 9 OU.
- [ ] errores de legalidad accionables.
- [ ] pruebas.

### Salida

Un usuario crea o importa un equipo OU válido y puede usarlo en una battle real.

## Fase 4 — Matchmaking, desafíos y replays

- [ ] cola por formato;
- [ ] cancelación;
- [ ] asignación atómica;
- [ ] desafíos privados;
- [ ] links/códigos;
- [ ] historial;
- [ ] replay persistente;
- [ ] visor de replay;
- [ ] protección/rate limits básicos.

### Salida

Loop completo: login -> team/random -> buscar/desafiar -> jugar -> resultado -> replay.

## Fase 5 — UI production-ready

- [ ] design tokens definitivos;
- [ ] dark/light;
- [ ] responsive completo;
- [ ] keyboard;
- [ ] reduced motion;
- [ ] accesibilidad;
- [ ] sprites/fallbacks;
- [ ] backgrounds propios/autorizados;
- [ ] VFX esenciales;
- [ ] estados de red;
- [ ] loading/empty/error;
- [ ] screenshots visual regression donde aporte valor.

### Salida

Battle y Team Builder cumplen los criterios de `DESIGN.md` en los viewports objetivo.

## Fase 6 — Beta

- [ ] observabilidad;
- [ ] logs estructurados;
- [ ] métricas de error;
- [ ] backups;
- [ ] límites de abuso;
- [ ] revisión de seguridad;
- [ ] revisión de assets/licencias;
- [ ] pruebas de carga de WebSocket/battles;
- [ ] estrategia de actualización del motor;
- [ ] deploy frontend;
- [ ] deploy game server;
- [ ] dominio/branding.

## Después del MVP

No iniciar sin mover explícitamente el elemento a alcance:

- ladder/rating;
- temporadas;
- doubles/VGC;
- más generaciones;
- espectadores;
- torneos;
- amigos/presencia;
- chat;
- Pokédex completa;
- estadísticas avanzadas;
- PWA;
- localización;
- formatos custom.

## Orden de prioridad

Cuando haya conflicto:

1. corrección del motor/integración;
2. seguridad y aislamiento de información;
3. estabilidad de multiplayer/reconexión;
4. UX de decisión;
5. persistencia/replay;
6. rendimiento;
7. polish visual;
8. funcionalidades nuevas.

No sacrificar corrección competitiva para avanzar una fase.
