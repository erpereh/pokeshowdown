# Arquitectura

Este documento define la arquitectura técnica fijada para PokeShowdown.

## Objetivo

Ejecutar Single Player y Private Battle sin mantener un servidor propio encendido 24/7.

La arquitectura utiliza:

- Vercel para frontend y compute serverless;
- Supabase para Auth, PostgreSQL y Realtime;
- Pokémon Showdown para simulación;
- PokéAPI solo como fuente complementaria;
- assets sincronizados desde las fuentes fijadas.

## Decisiones definitivas

1. Next.js + React + TypeScript.
2. Despliegue en Vercel.
3. Backend mediante Next.js Route Handlers / Vercel Functions.
4. Runtime Node.js para toda Function que importe Pokémon Showdown.
5. Pokémon Showdown no se ejecuta en el navegador.
6. No existe un backend persistente propio.
7. Supabase Auth gestiona identidad.
8. Supabase PostgreSQL conserva datos y battles.
9. Supabase Realtime Broadcast sincroniza Private Battle.
10. Single Player se resuelve serverless y se guarda después de cada turno.
11. Private Battle se resuelve serverless cuando existen ambas elecciones.
12. Ningún jugador actúa como host.
13. El estado se reconstruye desde datos canónicos persistidos.
14. Las decisiones privadas no se emiten mediante Realtime.

## Stack

| Área | Elección |
| --- | --- |
| Monorepo | pnpm workspaces |
| Frontend | Next.js + React + TypeScript |
| Estilos | Tailwind CSS + design tokens |
| Hosting | Vercel |
| Backend | Next.js Route Handlers / Vercel Functions |
| Runtime backend | Node.js 24.x |
| Motor | Pokémon Showdown |
| Auth | Supabase Auth |
| Base de datos | Supabase PostgreSQL |
| Tiempo real | Supabase Realtime Broadcast |
| Autorización DB | RLS + validación backend |
| Unit/integration | Vitest |
| E2E | Playwright |

Node 24.x se fija para mantener margen sobre el requisito Node actual del paquete Pokémon Showdown.

## Estructura objetivo

```text
/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── api/
│       │   │   ├── battles/
│       │   │   ├── rooms/
│       │   │   └── teams/
│       │   └── ...
│       └── ...
├── packages/
│   ├── battle-engine/
│   ├── battle-contract/
│   ├── pokemon-data/
│   ├── supabase/
│   ├── ui/
│   └── shared/
├── scripts/
│   ├── sync-data/
│   ├── sync-assets/
│   └── audit-assets/
├── public/
│   └── assets/
├── docs/
└── .env.example
```

No crear paquetes vacíos preventivamente.

## Límites de responsabilidad

### `apps/web`

Cliente:

- UI;
- navegación;
- Auth;
- Team Builder;
- salas;
- vistas de battle;
- historial/replays;
- suscripciones Realtime.

Backend serverless dentro de `app/api`:

- autenticación de operaciones sensibles;
- validación;
- llamadas a `battle-engine`;
- persistencia;
- resolución de turnos;
- CPU.

### `packages/battle-engine`

Paquete **server-only**.

Responsable de encapsular:

- `BattleStream`;
- `Dex`;
- `Teams`;
- `TeamValidator`;
- Random Battles;
- reconstrucción desde seed/input log;
- normalización del protocolo del motor;
- vistas/eventos internos.

No debe importarse desde componentes client-side.

### `packages/battle-contract`

Tipos compartidos seguros:

- requests;
- responses;
- public battle views;
- player-specific views;
- request ids;
- turn ids;
- códigos de error;
- eventos Realtime permitidos.

No contiene internals de Showdown.

### `packages/pokemon-data`

- adaptación de IDs;
- datos de presentación;
- PokéAPI complementaria;
- manifest de assets.

### `packages/supabase`

- cliente browser;
- cliente server;
- tipos generados;
- repositorios;
- helpers de Auth/RLS.

## Vercel Functions

Las Functions son efímeras.

No se asume memoria compartida entre invocaciones.

Por tanto:

- ningún estado crítico vive solo en RAM;
- cada invocación carga/reconstruye lo necesario;
- cada resultado se persiste antes de devolverlo como confirmado;
- retries deben ser seguros;
- una instancia reutilizada es una optimización, nunca una dependencia.

Las Functions que importen `pokemon-showdown` usan Node.js runtime, no Edge runtime.

## Supabase

### Variables

Cliente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Servidor:

```env
SUPABASE_SECRET_KEY=
```

La secret key nunca llega al bundle del navegador.

### Auth

Supabase Auth identifica al usuario.

Las Functions verifican la identidad antes de ejecutar operaciones sobre battles, teams o rooms.

Nunca confiar en un `userId` proporcionado por el body como prueba de identidad.

### PostgreSQL

Modelo conceptual:

#### `profiles`

- `user_id`;
- `display_name`;
- `avatar_key`;
- timestamps.

#### `teams`

- `id`;
- `owner_id`;
- `name`;
- `format_id`;
- `packed_team`;
- `engine_version`;
- timestamps.

#### `battle_rooms`

- `id`;
- `host_user_id`;
- `invite_code`;
- `format_id`;
- `status`;
- `expires_at`;
- timestamps.

#### `battles`

- `id`;
- `mode`: `singleplayer | private`;
- `format_id`;
- `engine_version`;
- `seed`;
- `current_turn`;
- `status`;
- `winner_user_id` nullable;
- `input_log` o referencia a representación canónica;
- timestamps.

#### `battle_players`

- `battle_id`;
- `user_id` nullable para CPU;
- `side`;
- snapshot/representación necesaria del team;
- metadata privada necesaria para reconstrucción.

#### `battle_choices`

- `battle_id`;
- `turn`;
- `side`;
- `request_id`;
- `choice`;
- timestamps.

Restricción lógica/única para impedir más de una elección activa por side/request salvo sustitución explícitamente permitida antes de cerrar el turno.

#### `battle_replays`

- `battle_id`;
- representación canónica del replay;
- metadata/versiones.

El schema final puede separar información pública y privada en tablas/esquemas distintos cuando se implemente RLS.

## RLS y privacidad

Toda tabla expuesta con datos de usuario debe tener RLS.

Principios:

- usuario modifica solo sus equipos;
- participantes acceden solo a la información permitida de sus battles;
- una elección pendiente no es legible por el rival;
- datos canónicos sensibles de resolución se leen solo desde backend cuando sea necesario;
- la secret key se usa únicamente tras autorización explícita en backend.

## Supabase Realtime

Usar **Broadcast** para Private Battle.

Realtime se utiliza para:

- turno resuelto;
- rival unido;
- ready state;
- battle finalizada;
- eventos de reanudación que necesiten refresco.

No se utiliza para enviar al rival una elección pendiente.

Los canales de battle deben ser privados y autorizados.

El cliente que recibe un evento Realtime puede invalidar/refrescar su vista desde el backend/DB en lugar de asumir que el payload contiene todo el estado.

## Single Player

### Resolución

```text
Browser
   │ POST choice
   ▼
Vercel Function (Node)
   │
   ├── autentica usuario
   ├── carga battle
   ├── reconstruye BattleStream
   ├── valida choice
   ├── calcula choice CPU
   ├── resuelve turno
   └── persiste
           │
           ▼
       Supabase
           │
           ▼
      response al browser
```

### Autosave

Cada turno resuelto debe quedar persistido **antes** de responder como confirmado.

Esto permite recuperar una battle aunque:

- se cierre la pestaña;
- se cierre el navegador;
- cambie el dispositivo;
- una Function desaparezca después de responder.

### Reanudación

1. autenticar usuario;
2. localizar Single Player activa;
3. cargar seed, engine version, teams y log canónico;
4. reconstruir el motor;
5. verificar el request actual;
6. enviar snapshot permitido;
7. continuar.

### Idempotencia

Cada elección incluye identificadores como:

- `battleId`;
- `turn`;
- `requestId`.

Un retry de la misma petición devuelve el resultado ya persistido o continúa de forma segura; nunca vuelve a aplicar el turno.

## Private Battle

### Creación de sala

```text
Host
  │
  ▼
Vercel Function
  │
  ├── crea room
  └── genera invite code
         │
         ▼
      Supabase
```

### Entrada

El segundo usuario presenta código/enlace.

Backend verifica:

- room existente;
- no expirada;
- hueco disponible;
- identidad;
- formato/configuración.

### Elecciones

```text
Player 1 ──POST choice──► Vercel ──► Supabase
Player 2 ──POST choice──► Vercel ──► Supabase
                                │
                         ambas disponibles
                                ▼
                      claim atomico del turno
                                │
                                ▼
                      Pokemon Showdown
                                │
                                ▼
                         persist result
                                │
                                ▼
                    Supabase Realtime Broadcast
                         │                 │
                         ▼                 ▼
                     Player 1          Player 2
```

### Resolución única

La transición:

```text
WAITING_CHOICES -> RESOLVING -> RESOLVED
```

debe protegerse con operación transaccional/atómica.

Solo una invocación puede reclamar `RESOLVING`.

Esto evita dobles resoluciones cuando las dos peticiones llegan simultáneamente.

### Hidden information

No almacenar datos privados en payloads Realtime accesibles al rival.

El backend genera una vista por side:

```text
canonical battle state
        │
        ├──► p1 view
        └──► p2 view
```

## Reconstrucción de battle

No serializar ciegamente objetos internos del motor como contrato permanente.

Preferencia:

```text
engine_version
+ seed
+ initial teams
+ canonical input log
= reconstructable battle
```

El input log se conserva de forma que no filtre decisiones privadas a clientes no autorizados.

La implementación debe comprobar determinismo y coste mediante tests/benchmarks antes de optimizar con checkpoints.

## Versionado

Cada battle y replay registra `engine_version`.

Actualizar Pokémon Showdown requiere:

1. fijar nueva versión;
2. ejecutar tests de integración;
3. verificar reconstrucción;
4. verificar TeamValidator;
5. verificar Random Battle;
6. verificar parser/adaptador;
7. comprobar replays relevantes.

## Seguridad

- Auth server-side para operaciones sensibles;
- RLS;
- secret key solo backend;
- no confiar en IDs enviados por cliente;
- validar schemas de requests;
- request IDs/idempotency;
- límites de tamaño;
- rate limiting si se vuelve necesario;
- no exponer teams/choices privados;
- no emitir HTML no confiable;
- logs sin tokens/secrets.

## Testing

### Unit

- normalizadores;
- battle contract;
- CPU strategy;
- idempotency helpers;
- view filtering.

### Integration

- `battle-engine` con versión fijada;
- TeamValidator;
- Teams;
- Random Battle;
- reconstrucción desde log;
- Single Player autosave;
- resolución atómica de Private Battle;
- RLS relevante;
- Realtime authorization.

### E2E

- registro/login;
- Team Builder;
- Single Player;
- cerrar/reabrir y continuar;
- crear room;
- entrar por invitación;
- battle privada con dos contextos;
- retry de choice;
- reanudación;
- historial;
- replay.

## Variables de entorno

`.env.example` contiene únicamente las variables necesarias actualmente.

No añadir configuración especulativa.
