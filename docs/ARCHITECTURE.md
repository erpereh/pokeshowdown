# Arquitectura serverless

MVP PvE: Next.js App Router, Route Handlers Node.js, Supabase Auth/PostgreSQL y Pokémon Showdown server-only. No hay servidor de batalla permanente, jugador-host, salas ni multijugador en esta entrega.

## Aplicación y motor

- Node.js 22.x, pnpm 10.34.5, Next.js 16.3.6 y pokemon-showdown 0.11.11 fijados.
- src/server/showdown adapta Dex, Teams, TeamValidator, BattleStream, PRNG y extractChannelMessages.
- battle-engine reconstruye el motor, convierte requests y obtiene frames públicos. CPU recibe solo su request y vista pública; no accede al objeto Battle.
- El frontend existente contiene shell, Auth, Team Builder, setup, combate, historial y replay. Tailwind v4 y componentes propios compartidos.
- Next proxy refresca cookies SSR y protege /friends, /play, /teams, /battle, /saved, /history y /replay. Los handlers autentican con getUser y nunca aceptan un userId del navegador.
- Confirmación Auth admite token_hash/type y code PKCE; recuperación termina en /auth/update-password.

Showdown no se importa en el navegador ni Edge. next.config conserva serverExternalPackages y outputFileTracingIncludes para dist/data y dist/config cargados dinámicamente. El build de producción usa next build --webpack para evitar los aliases de paquetes externos generados por Turbopack en directorios enlazados de .next al empaquetar Functions en Vercel. El adaptador admite la interoperabilidad CommonJS tanto de Node ESM como de Webpack; la importación diferida de CPU usa un literal que el bundler puede analizar. agentRules:false evita mutaciones automáticas de AGENTS. No hay RAM compartida entre invocaciones.

## Equipos y datos

OU resuelve player/cpu de forma independiente: random, inline o saved del propietario. Normaliza y valida con TeamValidator antes de crear cada batalla. El generador OU produce seis sets legales; Gen 9 Random Battle usa el generador oficial con niveles propios, sin preview.

PokéAPI aporta solo nombres/metadatos complementarios. No decide reglas ni bloquea una batalla. Assets locales se generan con el perfil runtime; Vercel ejecuta pnpm sync:assets --profile=runtime && pnpm build. Los estáticos de public no forman parte del bundle de la Function.

## Persistencia

| Tabla | Función |
| --- | --- |
| profiles | Perfil creado por trigger Auth; usuario solo actualiza display_name. |
| teams | Equipos/borradores gen9ou del dueño, packed_team <=8KiB, valid y versión. |
| battles | Formato, versión, estado, resultado, turno/revision, request p1, estado inicial y frames. |
| battle_secrets | Seed, equipos empaquetados, input log y checkpoint. Sin acceso anon/authenticated. |
| battle_actions | Decisión/rendición; client_request_id y revision_before únicos por partida. |
| battle_replays | Resultado y frames públicos de solo lectura, accesibles por su dueño. |

RLS en las seis tablas. Policies usan (select auth.uid()). anon carece de privilegios de producto; authenticated lee únicamente sus datos. Escritos de equipos y combate pasan por el servidor con secret key. create_battle y commit_battle_turn son security invoker y ejecutables únicamente por service_role.

El historial de diez migraciones locales coincide con las versiones y SQL aplicados vía MCP. La entrada init original registra un baseline; persistence_helpers/tables/rls y las siguientes contienen DDL real. No volver a aplicar una consolidación ni resetear una base existente.

## Resolución y reanudación

Elección → autenticar/validar → reconstruir Showdown desde engineVersion+seed+equipos+inputLog → calcular CPU → resolver → commit atómico → confirmar.

La reconstrucción compara turno y request crudo p1 con checkpoint. Se filtran canales con extractChannelMessages; HP del rival es porcentual. No se devuelven secretos, movimientos ocultos ni timestamps del protocolo.

create_request_id hace idempotente el inicio. Cada decisión incluye revision/clientActionId. commit_battle_turn bloquea la fila y comprueba revisión, inserta la acción, actualiza secretos antes de partida y crea replay al terminar. Constraints impiden duplicados. Una carrera recupera la vista vigente; una respuesta perdida se reintenta con el mismo ID y elección. El frontend hidrata la vista actual en respuestas repetidas.

Partidas finalizadas son inmutables. Una versión de motor distinta rechaza nuevas elecciones y permite rendición sin reconstruir. Replays históricos usan frames y versión almacenados. Las listas no cargan los frames completos: solo extraen con rutas JSON la especie y el spriteId del Pokémon activo de cada lado en los frames 0 y 1 (estado público; con team preview los líderes aparecen en el frame 1).

## Requests especiales

Se soportan equipos legales de uno a seis y preview acorde al tamaño real. Revival Blessing se deriva de side.pokemon.reviving: selección de debilitados, sanos deshabilitados. La curación de banquillo admite identidades sin letra activa (p1: Nombre), preservando estado y replay. La CPU usa default oficial para elegir un debilitado.

## Validación y operación

Vitest cubre contracts, CPU, sprites y reconstrucción; integración comprueba Supabase real, RLS, privilegios, RPC, CAS e inmutabilidad. Playwright corre Chromium desktop y Pixel 7 contra el servidor real; prepara cuentas dedicadas sin enviar correos y conserva sus registros, sin DELETE ni limpieza destructiva.

E2E recorre equipos, cuatro combinaciones OU, Random oficial, acciones especiales, reanudación, rendición, historial/replay, concurrencia y retry tras pérdida de transporte. Capturas y sesiones no se versionan. scripts/review-visuals.mjs genera informes/capturas de tres ciclos usando una sesión real de pruebas.

.env.example sigue como único contrato de producto: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY. La última es solo servidor. No se añaden servicios de pago ni variables hipotéticas.
