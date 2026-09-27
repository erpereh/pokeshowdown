# Arquitectura serverless

**Estado:** objetivo técnico aprobado. Hay aplicación Next.js en la raíz (`src/app`), adaptador del motor, pipeline de assets, esquema Supabase y Route Handlers de auth, equipos, dex y combate single player. La UI de juego y la batalla privada aún no están. Meta: funcionar en planes gratuitos mientras el uso encaje en sus cuotas, sin proceso propio encendido 24/7.

## Motor y assets ya presentes

| Pieza | Ubicación |
| --- | --- |
| Adaptador server-only de `Dex`, `Teams`, `TeamValidator`, `BattleStream`, `PRNG` y `extractChannelMessages` | `src/server/showdown/` |
| Combate single player: `BattleStream`, vista pública, reconstrucción y CPU | `src/server/battle-engine/` y `src/server/cpu/` |
| Nombres en español que Showdown no trae | `src/server/pokemon-data/` y `data/complement/es.json` |
| Sprites locales | `public/assets/generated/`, generados por `pnpm sync:assets` |

Node `>=22`. Showdown fijado en `0.11.11` e importado solo desde el servidor. `public/assets/generated/` no se versiona. `vercel.json` declara framework `nextjs` y `buildCommand` `pnpm sync:assets && pnpm build` (`next build`); no hay `outputDirectory`. Así un clone vacío regenera los sprites en el build. Esos estáticos no forman parte del bundle de la Function (tope de 250 MB sin comprimir en el plan gratuito). `pokemon-showdown` queda fuera del bundle (`serverExternalPackages`). El motor carga `dist/data` y `dist/config` con `require` dinámico, así que esas carpetas entran en las Functions de `/api` mediante `outputFileTracingIncludes`. No hay variables de entorno nuevas.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| Next.js en Vercel | Aplicación y Route Handlers/Functions para operaciones de juego. |
| `battle-engine` server-only | Adaptador de `BattleStream`, `Dex`, `Teams`, `TeamValidator`, CPU, parseo y reconstrucción. |
| `battle-contract` | Requests, respuestas, vistas autorizadas, versiones e identificadores de petición. |
| Supabase Auth/PostgreSQL | Identidad y estado durable: cuentas, equipos, salas, partidas, decisiones y replays. |
| Supabase Realtime Broadcast | Avisos a canales privados para que los participantes recuperen sus vistas actualizadas. |
| `pokemon-data` | Adaptadores de IDs y datos complementarios, separados de la simulación. |

La API oficial de Showdown se integra en **Functions con runtime Node.js**, no en el navegador ni Edge. Fijar una versión de Node y de Showdown compatibles. Ninguna Function depende de RAM compartida entre invocaciones.

### Aplicación Next.js

App Router en `src/app`. La página inicial es un placeholder. `src/app/api/health/route.ts` usa `runtime = 'nodejs'`, importa el adaptador y responde con `ENGINE_VERSION` y si existe el formato `gen9ou`.

`next.config.ts`: `reactStrictMode`, `typedRoutes: false`, `serverExternalPackages: ['pokemon-showdown']`. `agentRules: false` para que `next dev` no modifique `AGENTS.md`.

TypeScript cubre la app y los scripts `node --experimental-strip-types`: `jsx: react-jsx` (Next.js 16 lo exige; `preserve` se reescribe en `next typegen`), alias `@/*` → `src/*`, `allowImportingTsExtensions` con `noEmit` para conservar los imports `.ts`. `pnpm typecheck` ejecuta `next typegen && tsc --noEmit`. `next-env.d.ts` se versiona. El paquete `server-only` no trae tipos; sigue haciendo falta `src/types/server-only.d.ts`.

Estilos: Tailwind CSS v4 con `@tailwindcss/postcss`. Sin tokens visuales (ver `DESIGN.md`).

Pruebas: Vitest en `tests/unit` y `tests/integration` (alias de `server-only` a un módulo vacío). Playwright en `tests/e2e`, Chromium de escritorio y Pixel 7, contra `pnpm dev` en `http://localhost:3000`.

### Estructura actual

```text
src/app/                  App Router, Route Handlers y confirmación de auth
src/proxy.ts              refresco de sesión y páginas privadas (Next.js 16)
src/lib/supabase/         cliente de navegador
src/server/supabase/      clientes de servidor, admin y tipos generados
src/server/persistence/   equipos y partidas single player
src/server/showdown/      adaptador server-only del motor
src/server/battle-engine/ BattleStream, vista de p1 y reconstrucción por input log
src/server/cpu/           elección de la CPU (solo CpuInput; sin objeto Battle)
src/server/teams/         formato, validación, OU aleatorio y consultas Dex
src/server/pokemon-data/  complemento de datos
supabase/migrations/      esquema aplicado en el proyecto
scripts/                  sync y verificación
public/assets/generated/  sprites (no versionados)
```

No crear paquetes vacíos ni infraestructura adicional preventivamente. Las decisiones visuales quedan fuera de este documento.

## Modelo de datos

Single player persiste en Postgres. La batalla privada (salas, elecciones de dos jugadores y Realtime) sigue siendo objetivo y aún no tiene tablas.

| Tabla | Campos/propósito principales |
| --- | --- |
| `profiles` | `user_id` → `auth.users`, `display_name` (1–32). Alta con trigger al crear el usuario. El usuario autenticado solo puede actualizar `display_name`. |
| `teams` | Equipo gen9ou del dueño: `packed_team` (máximo 8 KiB), `valid`, `engine_version`, nombre 1–40. Lectura del dueño; altas y cambios solo con la clave de servicio. |
| `battles` | Partida single player: formato, versión de motor, estado, ganador, turno, `revision`, fondo, nombres, request de p1, estado inicial, frames, `create_request_id` único por dueño. |
| `battle_secrets` | Seed, equipos empaquetados, input log y checkpoint. Sin policies y sin privilegios para `anon` ni `authenticated`. |
| `battle_actions` | Elección o rendición, `client_request_id` y `revision_before` únicos por partida. |
| `battle_replays` | Replay de solo lectura al terminar, visible solo para el dueño. |

RLS en todas. Policies con `(select auth.uid())`. Lectura de partidas, acciones y replays solo del dueño; las escrituras de combate pasan por `create_battle` y `commit_battle_turn`, ejecutables solo por `service_role`. Esas funciones comparan la revisión, bloquean la fila, insertan la acción de forma idempotente, actualizan secretos antes que la partida y, si termina, insertan el replay. Una partida terminada no se actualiza; sí se puede borrar (también al borrar la cuenta).

`src/proxy.ts` refresca la cookie de sesión y redirige a `/auth?next=...` si no hay sesión en `/play`, `/teams`, `/battle`, `/saved` y `/history`. Si faltan las variables públicas de Supabase, esas páginas también redirigen a `/auth`. `/`, `/auth`, `/api/dex/*` y los estáticos no redirigen. Los Route Handlers de juego comprueban `getUser()` y no aceptan un `userId` en el body. Una partida de otra versión del motor rechaza elecciones con `engine_version_mismatch` y acepta la rendición sin reconstruir el simulador. El listado de partidas no descarga los frames.

## Motor y reconstrucción

El estado durable incluye, como mínimo, `engine_version + seed + equipos iniciales + input log canónico + estado/turno`. Reconstruir reejecuta ese input log en un `BattleStream` nuevo y compara turno y request crudo de p1 con el checkpoint. La semilla es sodium. Los equipos de ambos formatos quedan empaquetados en los secretos. La vista de p1 sale de `extractChannelMessages` (el rival en porcentajes) y omite las líneas `|t:|`. La CPU actúa solo cuando p2 tiene una request accionable y p1 no: en la previsualización de equipo y en los cambios forzados el orden no es simétrico. `chooseCpuActions` solo recibe el request de p2 y la vista pública. `src/server/teams/` valida con `TeamValidator`, genera equipos `gen9ou` desde sets de Random Battle y responde las búsquedas del Team Builder con `Dex`. No serializar objetos internos del motor ni prometer compatibilidad de reproducción entre versiones distintas; conservar suficiente log de eventos para ver replays históricos.

Ninguna acción se confirma antes de persistirse. Las decisiones incluyen `battleId`, `turn` y `requestId`. Usar versión/revisión de registro, transacciones o compare-and-swap para rechazar actualizaciones obsoletas.

## Single Player

```text
Elección → Function Node → autenticar/validar → reconstruir Showdown
         → elegir acción CPU → resolver → guardar turno → respuesta
```

Crear la partida en Supabase **antes de jugar el primer turno**. Guardar cada turno resuelto; reanudar desde el último estado confirmado tras cerrar navegador o cambiar de dispositivo. Los retries deben recuperar el resultado ya persistido, no volver a resolver el mismo request.

## Private Battle

```text
Crear/unirse por invitación → guardar elecciones privadas
→ ambas disponibles → reclamar resolución única → Showdown
→ persistencia durable → aviso Realtime privado → vista por jugador
```

Controlar carreras entre las dos peticiones mediante claim atómico por battle/turno. Una operación `RESOLVING` necesita expiración/lease y recuperación idempotente si una Function termina inesperadamente: ninguna batalla puede quedar bloqueada indefinidamente. Broadcast lleva avisos, **nunca elecciones pendientes ni estado canónico secreto**; tras el aviso cada cliente consulta su vista autorizada.

Supabase Realtime es un servicio gestionado, no autoridad de simulación. No hay jugador-host ni servidor de batalla propio permanente.

## Seguridad y despliegue

- Validar sesión/usuario en servidor; no confiar en `userId` del body.
- Secret key solo backend; RLS en tablas expuestas; canales Realtime privados y autorizados.
- No filtrar equipos/elecciones ocultos en consultas, respuestas, errores ni logs.
- Versionar motor/datos y fijar dependencias. Vigilar límites de Functions y quotas de los planes gratuitos.
- Guardado y reconstrucción deben tolerar reintentos, concurrencia y fallos parciales.

## Validación pendiente de implementación

Unit: contratos, CPU, normalización y filtrado. Integración: motor/reproducción determinista, legalidad, concurrencia/recuperación de claim de batalla privada y el flujo de acción contra el motor. Ya hay integración de RLS, CAS, idempotencia de `client_request_id` e inmutabilidad de partidas terminadas. E2E: login, equipos, Single Player con cierre/reanudación, sala privada con dos sesiones, retries, historial y replay.

## Configuración

`.env.example` es el único contrato actual:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Las dos primeras claves pueden ir al navegador; la tercera nunca. No introducir más variables hasta que sean necesarias.
