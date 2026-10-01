# Arquitectura serverless

PvE contra CPU y combates online entre amigos: Next.js App Router, Route Handlers Node.js, Supabase Auth/PostgreSQL/Realtime y Pokémon Showdown server-only. No hay servidor de batalla permanente, jugador-host ni salas: cada petición reconstruye el combate desde el log persistido.

## Aplicación y motor

- Node.js 22.x, pnpm 10.34.5, Next.js 16.3.6 y pokemon-showdown 0.11.11 fijados.
- src/server/showdown adapta Dex, Teams, TeamValidator, BattleStream, PRNG y extractChannelMessages.
- battle-engine reconstruye el motor, convierte requests y obtiene frames públicos. CPU recibe solo su request y vista pública; no accede al objeto Battle.
- El frontend existente contiene shell, Auth, Team Builder, setup, combate, historial y replay. Tailwind v4 y componentes propios compartidos.
- Next proxy refresca cookies SSR y protege /friends, /challenge, /play, /teams, /battle, /saved, /history y /replay. Los handlers autentican con getUser y nunca aceptan un userId del navegador.
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
| profiles.friend_code | Código de amigo de 8 caracteres (alfabeto sin I/L/O/0/1) generado por default con gen_friend_code; único e inmutable (trigger). |
| friend_requests | Solicitudes pending/accepted/declined/cancelled; un único pendiente por par no ordenado. Lectura para requester/addressee. |
| friendships | Par ordenado user_low < user_high. Lectura para ambos miembros. |
| user_presence | Heartbeat last_seen_at (solo servidor). En línea = latido en los últimos 75 s. |
| challenges | Reglas fijadas al crear (formato, timer, origen OU, TTL, expires_at) protegidas por trigger; estados pending/preparing/started/declined/cancelled/expired; flags ready; un único abierto por par (índice parcial). Lectura para ambos participantes. |
| challenge_entries | Equipo empaquetado de cada jugador para el desafío. Solo servidor. |
| online_matches | Estado compartido sin secretos: asientos p1 (retador) y p2, revision, turno, pendientes y plazos por lado, resultado. Lectura para ambos participantes. |
| online_match_secrets | Seed, equipos, input log y checkpoint {turn, p1RequestRaw, p2RequestRaw}. Solo servidor. |

RLS en todas las tablas. Policies usan (select auth.uid()). anon carece de privilegios de producto; authenticated lee únicamente sus datos. Escritos de equipos y combate pasan por el servidor con secret key. create_battle, commit_battle_turn y las RPC sociales/online (send_friend_request, respond_friend_request, remove_friend, touch_presence, create_challenge, respond_challenge, set_challenge_ready, expire_stale_challenges, create_online_match, commit_online_step, finish_online_seat) son security invoker y ejecutables únicamente por service_role.

El historial de migraciones locales (incluidas friends, challenges, online_battles y social_realtime) coincide con las versiones y SQL aplicados vía MCP. La entrada init original registra un baseline; persistence_helpers/tables/rls y las siguientes contienen DDL real. No volver a aplicar una consolidación ni resetear una base existente.

## Resolución y reanudación

Elección → autenticar/validar → reconstruir Showdown desde engineVersion+seed+equipos+inputLog → calcular CPU → resolver → commit atómico → confirmar.

La reconstrucción compara turno y request crudo p1 con checkpoint. Se filtran canales con extractChannelMessages; HP del rival es porcentual. No se devuelven secretos, movimientos ocultos ni timestamps del protocolo.

create_request_id hace idempotente el inicio. Cada decisión incluye revision/clientActionId. commit_battle_turn bloquea la fila y comprueba revisión, inserta la acción, actualiza secretos antes de partida y crea replay al terminar. Constraints impiden duplicados. Una carrera recupera la vista vigente; una respuesta perdida se reintenta con el mismo ID y elección. El frontend hidrata la vista actual en respuestas repetidas.

Partidas finalizadas son inmutables. Una versión de motor distinta rechaza nuevas elecciones y permite rendición sin reconstruir. Replays históricos usan frames y versión almacenados. Las listas no cargan los frames completos: solo extraen con rutas JSON la especie y el spriteId del Pokémon activo de cada lado en los frames 0 y 1 (estado público; con team preview los líderes aparecen en el frame 1).

## Amigos, desafíos y combate online

- Rutas: GET /api/friends (overview: yo, amigos con presencia, solicitudes, desafíos abiertos), POST /api/friends/requests, POST /api/friends/requests/[id]/(accept|decline|cancel), DELETE /api/friends/[userId], POST /api/presence, POST /api/challenges, GET /api/challenges/[id], POST /api/challenges/[id]/(accept|decline|cancel|ready). El combate reutiliza /api/battles/[id], /actions y /forfeit.
- Asientos: cada jugador tiene su propia fila battles (mode online, match_id) con frames, request y resultado desde su perspectiva y siempre como p1. Showdown corre con ambos lados humanos; la salida del lado p2 se espeja (battle-engine/perspective.ts) intercambiando ids de lado, sin tocar nombres. Por eso BattleScreen, historial, replay y RLS por dueño se reutilizan sin cambios estructurales.
- Inicio: set_challenge_ready bloquea el desafío y devuelve si ambos están listos; entonces el servidor crea el motor (battle-engine/online.ts) y create_online_match inserta partida, secretos y los dos asientos de forma atómica e idempotente por challenge_id. GET del desafío reintenta el arranque si un fallo lo dejó listo sin partida.
- Turno: cada elección reconstruye Showdown, comprueba con isChoiceDone que ese lado aún debe elegir y escribe solo su línea. Si el otro lado sigue pendiente no hay frame nuevo: su asiento recibe una request wait. commit_online_step bloquea la partida, hace CAS sobre su revision, registra la acción en el asiento del actor, añade frames a ambos asientos cuando hubo protocolo nuevo, recalcula pendientes y plazos con now() de la base de datos e inserta los dos replays al terminar. Ante P0004 el servidor recalcula (hasta 4 intentos) mientras la request del jugador siga vigente.
- Temporizador: los plazos viven en online_matches. Se resuelven de forma perezosa en cualquier lectura (vista del combate, lista de partidas, overview de amigos) o cuando la cuenta atrás del cliente llega a cero: el servidor escribe >forcelose (o >forcetie si vencen ambos) y la RPC vuelve a comprobar el plazo contra su reloj (P0005). No hace falta ninguna Function permanente.
- Caducidad: expires_at/prepare_expires_at se aplican de forma perezosa con expire_stale_challenges y dentro de cada RPC.
- Realtime: friend_requests, challenges y online_matches están en la publicación supabase_realtime. El cliente (src/client/social/store.ts) abre un canal por usuario filtrado por sus ids; RLS limita los eventos a los participantes. Los mensajes son solo una señal: siempre se vuelve a leer por la API. Hay polling de respaldo (30 s overview, 4–15 s en combate) y resincronización al volver a la pestaña o al reconectar.
- Presencia: heartbeat POST /api/presence cada 30 s con la pestaña visible.

## Requests especiales

Se soportan equipos legales de uno a seis y preview acorde al tamaño real. Revival Blessing se deriva de side.pokemon.reviving: selección de debilitados, sanos deshabilitados. La curación de banquillo admite identidades sin letra activa (p1: Nombre), preservando estado y replay. La CPU usa default oficial para elegir un debilitado.

## Validación y operación

Vitest cubre contracts, CPU, sprites, reconstrucción, motor online y espejo de perspectiva; integración comprueba Supabase real, RLS, privilegios, RPC, CAS, inmutabilidad, amistad, desafíos simultáneos, caducidad, arranque concurrente, elecciones simultáneas y timeout. Playwright corre Chromium desktop y Pixel 7 contra el servidor real; prepara cuentas dedicadas sin enviar correos. Las pruebas online crean sus propias cuentas temporales y al terminar borran solo esos usuarios (y las partidas que quedan huérfanas); el resto de registros QA se conserva.

Con E2E_BASE_URL (variable solo del runner de pruebas) Playwright apunta a un despliegue sin levantar el servidor local e inyecta la sesión SSR obtenida de Supabase en vez de rellenar el formulario. E2E online usa dos contextos de navegador aislados: código de amigo, solicitud y aceptación desde otra sección, desafío OU configurado, invitación en tiempo real, lobby, Ready, Team Preview, combate completo, historial de ambos, desconexión/reconexión y derrota por tiempo. E2E PvE recorre equipos, cuatro combinaciones OU, Random oficial, acciones especiales, reanudación, rendición, historial/replay, concurrencia y retry tras pérdida de transporte. Capturas y sesiones no se versionan. scripts/review-visuals.mjs genera informes/capturas de tres ciclos usando una sesión real de pruebas.

.env.example sigue como único contrato de producto: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY. La última es solo servidor. No se añaden servicios de pago ni variables hipotéticas.
