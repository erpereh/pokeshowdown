# Arquitectura

Este documento define la arquitectura técnica del proyecto.

## Estado

Actualmente el repositorio contiene documentación y todavía no existe implementación de aplicación.

Por tanto, las secciones marcadas como **arquitectura objetivo** describen la base aprobada para iniciar el desarrollo. En cuanto exista código, este documento debe actualizarse para representar la implementación real.

## Decisiones principales

1. Frontend propio; no se reutiliza código del cliente oficial de Pokémon Showdown.
2. El motor oficial `pokemon-showdown` se integra en backend como autoridad de simulación y validación.
3. El frontend no habla directamente con `BattleStream` ni depende del protocolo textual interno del motor.
4. El game server traduce el motor a un protocolo propio, tipado y estable para nuestros clientes.
5. El servidor es autoritativo.
6. Persistencia y autenticación estarán separadas del proceso de simulación.
7. Las versiones de motor y fuentes de datos se fijan y actualizan deliberadamente.

## Stack objetivo

| Área | Elección |
| --- | --- |
| Monorepo | pnpm workspaces |
| Frontend | Next.js + React + TypeScript |
| Estilos | Tailwind CSS + design tokens |
| Componentes | componentes propios; librería base solo cuando reduzca complejidad sin imponer identidad visual |
| Backend HTTP | Node.js + TypeScript |
| Tiempo real | WebSocket |
| Motor | paquete/repo oficial `pokemon-showdown` |
| Datos de combate | `Dex`, `Teams`, `TeamValidator` y APIs públicas del motor |
| Base de datos | PostgreSQL |
| Plataforma de datos/auth | Supabase como opción objetivo inicial |
| Tests unitarios | Vitest |
| E2E | Playwright |
| Frontend deploy | Vercel |
| Game server | contenedor Docker en servicio/VPS con conexiones persistentes |
| Observabilidad | logs estructurados + métricas/error tracking a definir |

Las versiones concretas se fijarán al crear el workspace. No se usará automáticamente `latest` en producción.

## Estructura objetivo

```text
/
├── apps/
│   ├── web/                    # Next.js: UI, navegación y cliente realtime
│   └── game-server/            # API, WebSocket, matchmaking y battles
│
├── packages/
│   ├── battle-engine/          # Adaptador de pokemon-showdown
│   ├── battle-protocol/        # Mensajes cliente-servidor y eventos tipados
│   ├── pokemon-data/           # Lectura/normalización de datos presentacionales
│   ├── ui/                     # Design system y componentes compartidos
│   └── shared/                 # Tipos/utilidades sin dependencias de UI
│
├── scripts/
│   ├── sync-data/              # Sincronización controlada de datos
│   ├── sync-assets/            # Obtención/procesado permitido de assets
│   └── audit-assets/           # Cobertura y reporte de assets
│
├── tests/
│   └── fixtures/               # Fixtures estables, sin duplicar reglas del motor
│
└── docs/
```

No deben crearse todos los paquetes de forma preventiva. Se añadirán cuando la implementación los necesite, manteniendo esta separación conceptual.

## Límites de responsabilidad

### `apps/web`

Responsable de:

- renderizar la aplicación;
- autenticación del usuario;
- Team Builder;
- estado de navegación;
- conexión WebSocket;
- representar snapshots/eventos de batalla;
- UX de reconexión;
- consumo de APIs HTTP.

No debe:

- determinar daño;
- decidir legalidad final de un equipo;
- generar Random Teams como autoridad;
- mantener secretos;
- asumir información oculta del rival.

### `apps/game-server`

Responsable de:

- autorizar conexiones;
- crear y cerrar sesiones realtime;
- matchmaking;
- desafíos;
- ciclo de vida de battles;
- validar decisiones;
- controlar timeouts;
- coordinar persistencia;
- traducir eventos del motor;
- garantizar que cada jugador recibe solo la vista permitida.

Debe poder ejecutarse independientemente del frontend.

### `packages/battle-engine`

Es una capa anti-corrupción alrededor de Pokémon Showdown.

Responsable de:

- iniciar battles;
- alimentar `BattleStream`;
- enviar jugadores y decisiones;
- consumir el protocolo del simulador;
- validar equipos con `TeamValidator`;
- importar/exportar/packear con `Teams`;
- consultar datos competitivos mediante `Dex`;
- exponer tipos y errores propios al resto del proyecto.

Ninguna UI debe importar internals de Pokémon Showdown directamente.

### `packages/battle-protocol`

Define el contrato entre web y game server.

Debe incluir:

- versión de protocolo;
- mensajes cliente -> servidor;
- eventos servidor -> cliente;
- esquemas runtime;
- códigos de error;
- snapshots;
- eventos de reconexión.

Los mensajes deben ser idempotentes cuando sea necesario. Las decisiones de turno necesitan identificadores de battle/turn/request para poder rechazar mensajes obsoletos o repetidos.

## Motor de Pokémon Showdown

La integración objetivo usa el motor oficial como librería, no el servidor público de Pokémon Showdown.

APIs relevantes:

- `BattleStream`: simulación;
- `Dex`: datos del juego/formato;
- `Teams`: serialización, importación/exportación y generación disponible;
- `TeamValidator`: legalidad.

### Regla de aislamiento

El formato textual de eventos de Showdown puede cambiar entre versiones. Solo `battle-engine` debe conocerlo.

El resto de la aplicación trabaja con eventos propios, por ejemplo:

```ts
type BattleEvent =
  | { type: "turn.started"; turn: number }
  | { type: "pokemon.hp"; side: "p1" | "p2"; slot: number; hp: HpView }
  | { type: "choice.requested"; requestId: string; choices: ChoiceView[] }
  | { type: "battle.finished"; winnerId: string | null };
```

El ejemplo ilustra el límite arquitectónico; no fija todavía el schema definitivo.

## Flujo de batalla

```text
Browser
  │  choice
  ▼
WebSocket gateway
  │  auth + battle membership + request validation
  ▼
Battle session
  │
  ▼
battle-engine adapter
  │
  ▼
Pokémon Showdown BattleStream
  │
  ▼
battle-engine parser
  │  normalized events
  ▼
visibility/filter layer
  │
  ├──► Player 1 view
  ├──► Player 2 view
  └──► Spectator view (futuro)
```

### Creación

1. Matchmaking/desafío produce dos participantes compatibles.
2. El servidor valida el formato y equipos.
3. Se crea un identificador único.
4. Se inicia el motor.
5. Se registran participantes.
6. Se envía el primer snapshot/request.

### Turno

1. El motor solicita elección.
2. Cada cliente recibe solo sus opciones.
3. El cliente envía una decisión con `battleId` y `requestId`.
4. El servidor valida identidad, pertenencia y vigencia.
5. El adaptador escribe la elección en el motor.
6. El motor resuelve.
7. El servidor persiste los eventos necesarios y distribuye vistas filtradas.

### Fin

1. El motor emite el resultado.
2. La sesión se marca finalizada de forma idempotente.
3. Se persisten resultado y replay.
4. Se actualizan estadísticas/rating si el formato lo requiere.
5. La sesión realtime puede liberarse tras un periodo corto.

## Reconexión

Cada battle debe mantener un snapshot reconstruible.

Al reconectar:

1. autenticar usuario;
2. localizar battle activa;
3. comprobar pertenencia;
4. enviar snapshot permitido;
5. enviar request pendiente si existe;
6. continuar sin reejecutar decisiones previas.

No se confiará en el estado almacenado únicamente en el navegador.

## Persistencia

Esquema conceptual inicial:

### `profiles`

- `user_id`
- `display_name`
- `avatar_key`
- timestamps

### `teams`

- `id`
- `owner_id`
- `name`
- `format_id`
- `packed_team` o representación canónica
- `engine_version`
- timestamps

### `battles`

- `id`
- `format_id`
- `engine_version`
- `status`
- `winner_user_id` nullable
- timestamps

### `battle_players`

- `battle_id`
- `user_id`
- `side`
- snapshot del equipo cuando sea necesario para reproducibilidad

### `battle_replays`

- `battle_id`
- log/eventos canónicos
- metadata de versión

### Futuro: `ratings`

Debe diseñarse cuando se incorpore ladder para no contaminar el MVP con reglas aún no definidas.

## Autenticación

Objetivo inicial: Supabase Auth.

- El navegador obtiene una sesión.
- El backend valida el token.
- La identidad de WebSocket se establece en servidor.
- Nunca se acepta un `userId` enviado por el cliente como prueba de identidad.
- La service role no se expone al navegador.

No se utilizará el login server oficial de Pokémon Showdown.

## Fuentes de datos

La prioridad y derechos se documentan en `DATA-SOURCES.md`.

Regla principal:

- mecánicas, legalidad y formatos: Pokémon Showdown;
- presentación enriquecida: fuentes auxiliares normalizadas;
- assets: inventario separado con procedencia y derechos.

## Assets

Los assets no deben importarse ad hoc desde URLs dentro de componentes.

La aplicación consumirá un manifiesto interno, por ejemplo:

```ts
type PokemonAssetManifest = {
  speciesId: string;
  front?: AssetRef;
  back?: AssetRef;
  shinyFront?: AssetRef;
  shinyBack?: AssetRef;
  icon?: AssetRef;
  artwork?: AssetRef;
};
```

El pipeline deberá poder detectar faltantes y fallback sin romper la batalla.

## Seguridad

Mínimos desde el inicio:

- validar input en frontera HTTP/WebSocket;
- autorización en servidor;
- rate limits para auth, desafíos y matchmaking;
- tamaño máximo de mensajes;
- timeouts;
- sanitizar cualquier contenido generado por usuarios;
- no renderizar HTML de protocolo de terceros sin sanitización;
- secretos solo en backend;
- RLS cuando aplique en Supabase;
- evitar enumeración innecesaria de datos privados;
- logs sin tokens, contraseñas ni equipos privados completos salvo necesidad explícita.

## Versionado

Cada battle/replay debe registrar la versión del motor usada.

Actualizar Pokémon Showdown requiere:

1. revisar cambios upstream relevantes;
2. ejecutar suite de simulación/integración;
3. validar formatos publicados;
4. comprobar parser/protocolo;
5. comprobar fixtures/replays;
6. actualizar documentación;
7. desplegar de forma controlada.

No se actualizará el motor de forma automática en producción sin validación.

## Testing

### Unitario

- parsers;
- normalización;
- protocolo;
- autorización pura;
- utilidades.

No duplicar tests exhaustivos de mecánicas ya cubiertas por upstream.

### Integración

- nuestro adaptador contra una versión fijada de `pokemon-showdown`;
- validación de equipos;
- inicio y final de battles;
- decisiones inválidas;
- Random Battle;
- desconexión/reconexión;
- persistencia.

### E2E

Mínimo:

- registro/login;
- crear/importar/validar equipo;
- iniciar desafío;
- matchmaking;
- completar batalla desde dos contextos de navegador;
- reconectar;
- abrir replay.

## Despliegue

### Frontend

Vercel es la opción inicial.

### Game server

No se desplegará como función serverless de corta duración porque las battles y WebSockets necesitan conexiones persistentes.

Se ejecutará como servicio Node.js en Docker.

### Base de datos/auth

Supabase es la opción inicial para PostgreSQL/Auth.

La arquitectura debe permitir sustituir servicios sin tocar el motor de batalla ni el protocolo del frontend.

## Decisiones pendientes antes de implementación

- librería concreta del servidor WebSocket;
- proveedor final del game server;
- estrategia exacta de presencia;
- retención de replays;
- sistema de rating;
- CDN/almacenamiento final de assets;
- política pública de espectador;
- marca definitiva.
