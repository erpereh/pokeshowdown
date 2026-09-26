# Arquitectura

Este documento define la arquitectura técnica aprobada del proyecto.

## Estado

Actualmente el repositorio contiene documentación y todavía no existe una implementación de aplicación.

Las decisiones de este documento son la base para iniciar el desarrollo y deben mantenerse actualizadas cuando exista código real.

## Decisiones principales

1. Frontend propio con Next.js + React + TypeScript.
2. Pokémon Showdown se integra en backend como autoridad de simulación y validación.
3. El frontend no depende directamente de `BattleStream` ni del protocolo interno textual de Showdown.
4. El game server traduce el motor a un protocolo propio y tipado.
5. El servidor es autoritativo.
6. **Supabase es la plataforma definitiva de autenticación y persistencia.**
7. Las battles activas viven en el game server, no en Supabase.
8. La comunicación de battle se realiza mediante WebSockets.
9. Pokémon Showdown es la fuente principal de datos competitivos.
10. PokéAPI solo complementa datos de Pokédex.
11. Los assets principales proceden de Showdown y se sincronizan localmente.

## Stack

| Área | Elección |
| --- | --- |
| Monorepo | pnpm workspaces |
| Frontend | Next.js + React + TypeScript |
| Estilos | Tailwind CSS + design tokens |
| Backend | Node.js + TypeScript |
| Tiempo real | WebSocket |
| Motor | Pokémon Showdown |
| Base de datos | Supabase PostgreSQL |
| Autenticación | Supabase Auth |
| Autorización de datos | Supabase RLS + validación backend |
| Storage | No necesario inicialmente |
| Tests unitarios | Vitest |
| E2E | Playwright |
| Frontend deploy | Vercel |
| Game server | Node.js en Docker / servicio persistente |

## Estructura objetivo

```text
/
├── apps/
│   ├── web/
│   └── game-server/
├── packages/
│   ├── battle-engine/
│   ├── battle-protocol/
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
│       ├── generated/
│       └── custom/
├── tests/
├── docs/
├── .env.example
└── AGENTS.md
```

No crear paquetes preventivamente. Esta estructura marca límites de responsabilidad.

## Responsabilidades

### `apps/web`

- UI;
- navegación;
- Supabase Auth en cliente;
- Team Builder;
- perfiles;
- historial;
- conexión WebSocket;
- renderizado del estado de battle;
- estados de reconexión.

No debe:

- calcular daño;
- decidir legalidad final;
- generar Random Teams como autoridad;
- almacenar secretos;
- acceder a service role;
- asumir información oculta del rival.

### `apps/game-server`

- autenticar conexiones;
- verificar JWT/sesión de Supabase;
- WebSockets;
- matchmaking;
- desafíos;
- battles activas;
- timeouts;
- reconexión;
- autorización de decisiones;
- integración con `battle-engine`;
- persistencia de resultados y replays en Supabase.

### `packages/battle-engine`

Capa de aislamiento frente a Pokémon Showdown.

Responsable de:

- `BattleStream`;
- `Dex`;
- `Teams`;
- `TeamValidator`;
- generación Random Battle;
- parser de eventos;
- traducción a tipos internos.

Solo este paquete debe conocer internals/protocolo del motor cuando sea posible.

### `packages/battle-protocol`

Contrato entre web y game server:

- versión de protocolo;
- mensajes cliente -> servidor;
- eventos servidor -> cliente;
- snapshots;
- request IDs;
- errores;
- reconexión.

Las decisiones deben incluir identificadores suficientes para rechazar mensajes duplicados u obsoletos.

### `packages/pokemon-data`

- adaptación de `Dex`;
- normalización de IDs;
- datos complementarios de PokéAPI;
- manifests de assets;
- helpers de presentación.

Nunca reemplaza al motor como autoridad.

### `packages/supabase`

- clientes tipados;
- tipos generados de base de datos;
- helpers server/client;
- repositorios de persistencia;
- utilidades de RLS/auth.

No debe contener lógica de combate.

## Arquitectura de battle

```text
Browser
  │
  │ WebSocket: choice / reconnect
  ▼
Game server
  │
  ├── valida sesion Supabase
  ├── valida battle + jugador + request
  │
  ▼
battle-engine
  │
  ▼
Pokémon Showdown BattleStream
  │
  ▼
normalizacion + filtro de visibilidad
  │
  ├──► Player 1
  └──► Player 2

Al finalizar / checkpoint necesario:
  Game server ──► Supabase PostgreSQL
```

## Estado vivo vs persistencia

### Estado vivo

Debe residir en el game server:

- instancia de battle;
- request actual;
- elecciones pendientes;
- timers;
- conexiones;
- estado de reconexión;
- eventos necesarios para continuar.

### Persistencia Supabase

Debe almacenar:

- usuarios;
- perfiles;
- equipos;
- battles finalizadas/metadatos;
- participantes;
- resultado;
- replay;
- preferencias;
- rating/estadísticas cuando se implementen.

No escribir cada frame/evento visual en PostgreSQL.

## Supabase

Supabase queda fijado como dependencia principal del proyecto.

### Auth

Usos:

- registro;
- login;
- logout;
- recuperación de contraseña;
- sesión persistente.

El cliente puede usar:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

El servidor puede usar además:

- `SUPABASE_SERVICE_ROLE_KEY`.

La service role nunca se expone al navegador.

### PostgreSQL

Esquema conceptual inicial:

#### `profiles`

- `user_id` FK a `auth.users`;
- `display_name`;
- `avatar_key`;
- preferencias;
- timestamps.

#### `teams`

- `id`;
- `owner_id`;
- `name`;
- `format_id`;
- representación canónica/packed team;
- `engine_version`;
- timestamps.

#### `battles`

- `id`;
- `format_id`;
- `engine_version`;
- `status`;
- `winner_user_id` nullable;
- timestamps.

#### `battle_players`

- `battle_id`;
- `user_id`;
- `side`;
- snapshot de equipo cuando corresponda.

#### `battle_replays`

- `battle_id`;
- log/eventos canónicos;
- metadata de versión.

#### Futuro

- `ratings`;
- `friends`;
- `user_stats`;
- `user_settings`.

### RLS

RLS debe activarse en tablas de usuario.

Reglas mínimas:

- un usuario lee/modifica su perfil permitido;
- un usuario solo modifica sus equipos;
- replays privados solo son visibles por usuarios autorizados;
- service role solo se utiliza en operaciones backend que realmente lo requieran.

### Supabase Realtime

No se utilizará para sustituir el protocolo de battle.

Puede usarse en el futuro para presencia o funciones secundarias si aporta valor, pero no es la fuente de verdad del combate.

### Supabase Storage

No es necesario inicialmente.

Los assets de Pokémon se gestionan con nuestro pipeline local. Storage podría usarse más adelante para avatares/uploads propios.

## Data sources

Ver `DATA-SOURCES.md`.

Resumen:

- Showdown: autoridad competitiva;
- PokéAPI: complemento de Pokédex;
- conflictos funcionales: gana Showdown.

## Assets

Ver `ASSET-INVENTORY.md`.

Los componentes no deben contener URLs externas de sprites.

`scripts/sync-assets` reconstruye `public/assets/generated/`.

`public/assets/generated/` se ignora en Git.

Los assets propios del proyecto pueden vivir en `public/assets/custom/`.

## Reconexión

Al reconectar:

1. validar sesión;
2. localizar battle activa;
3. verificar pertenencia;
4. reconstruir/enviar snapshot permitido;
5. enviar request pendiente;
6. continuar sin reejecutar decisiones.

El navegador no es fuente de verdad.

## Seguridad

- validar input HTTP/WebSocket;
- validar token Supabase;
- autorización en servidor;
- RLS;
- rate limits cuando existan endpoints expuestos;
- tamaño máximo de mensajes;
- timeouts;
- secretos solo backend;
- nunca loggear tokens o service role;
- no confiar en `userId` enviado por cliente;
- filtrar información oculta antes de emitirla.

## Versionado del motor

Cada battle/replay persistido debe registrar la versión de Pokémon Showdown usada.

Actualizar el motor requiere validar:

- integración;
- parser;
- formatos;
- TeamValidator;
- Random Battles;
- tests;
- replays relevantes.

## Testing

### Unit

- parsers;
- normalización;
- protocolo;
- helpers Supabase;
- autorización.

### Integración

- battle-engine contra una versión fijada;
- TeamValidator;
- Teams;
- Random Battle;
- persistencia Supabase;
- RLS relevante;
- reconexión.

### E2E

- auth;
- Team Builder;
- validación;
- matchmaking;
- battle con dos browser contexts;
- reconexión;
- historial;
- replay.

## Variables de entorno

`.env.example` es la fuente de verdad de nombres de variables.

Nunca versionar valores reales.

## Decisiones todavía abiertas

- librería concreta del servidor WebSocket;
- proveedor final del game server;
- ORM/query layer si realmente hace falta;
- retención exacta de replays;
- diseño del rating;
- estrategia final de deploy;
- marca definitiva.
