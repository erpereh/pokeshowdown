# Validación del MVP PvE

Validación ejecutada el 27 de septiembre de 2026 sobre el trabajo existente de main, partiendo de 87da02e. No se recreó el proyecto ni se implementó multijugador.

## Checkpoints

1. **Inventario e integración:** revisión de AGENTS, documentos, último commit y árbol limpio. Motor, CPU, API, persistencia, Team Builder, arena y replay ya existían. Los bloqueos eran reviving, selección de Revival, protocolo de banquillo, preview de equipos menores de seis, retry del cliente y cobertura E2E ausente.
2. **Correcciones:** integración de requests especiales; recuperación de respuestas inciertas sin duplicar decisiones; Auth recovery/PKCE; foco/modal/radios; contención de sprites y recuperación del índice; cabecera del editor. Se conservaron los módulos existentes.
3. **Backend real:** auditoría MCP del proyecto pokeshowdown; pruebas reales de persistencia, aislamiento y RPC. Se alinearon los archivos locales con las diez migraciones ya aplicadas, sin cambiar el historial remoto.
4. **Jugabilidad y revisión:** E2E en desktop/móvil, tres ciclos visuales con correcciones y repetición. Build de producción y repetición final de los recorridos reales.

## Comprobaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| pnpm install --frozen-lockfile | Correcto, sin cambiar el lockfile. |
| pnpm sync:assets --profile=runtime | 6.054 archivos; ningún fallo de descarga. |
| pnpm audit:assets | Correcto; cero archivos ausentes o huérfanos. |
| pnpm typecheck | Correcto. |
| pnpm test | 60/60; nueve archivos, incluida integración Supabase real. |
| pnpm verify:engine | Correcto; adaptador server y motor 0.11.11. |
| pnpm build | Correcto; compilación, TypeScript, generación y rutas. |
| pnpm test:e2e | 12/12 en desarrollo y 12/12 sobre producción (3,0 minutos). |
| Repetición focalizada Revival/reanudación | 2/2; se cierra todo el contexto del navegador. |
| git diff --check | Correcto. |

No existe script lint en package.json. Next avisa del pnpm-lock.yaml ajeno al repositorio en C:/Users/david; no impide el build. Playwright avisa de NO_COLOR/FORCE_COLOR del entorno; no es un fallo de aplicación.

## Empaquetado de producción para Vercel

Comprobado con Node.js 22.23.3: typecheck, 60/60 tests, verify:engine y next build --webpack correctos. Se preservan serverExternalPackages y outputFileTracingIncludes de Showdown. Solo se adaptaron las importaciones CommonJS y la importación diferida de CPU para su análisis por Webpack, sin modificar decisiones ni reglas del motor.

El build limpio conserva la caché de assets y no genera el alias .next/node_modules de Turbopack. Inspección de 35 manifiestos .nft.json: 44.071 referencias resolubles, sin enlaces rotos ni referencias al alias generado; las 19 rutas API incluyen Showdown, dist/data y dist/config. Producción local responde correctamente en /api/health (motor 0.11.11 y OU disponible) y en la búsqueda de Pikachu del Dex. E2E focalizado de producción: 4/4 en desktop/móvil, completando las cuatro combinaciones OU y Random oficial, acciones CPU, concurrencia/idempotencia y rendición, contra backend real.

sync:assets con VERCEL=1, mirror existente y salida temporal publicó 6.054 archivos: linked=0, copied=6054. Se verificaron todos mediante SHA-256 y stat: idénticos al origen, archivos regulares con nlink=1 e identidad distinta del mirror. Las evidencias están en artifacts/deployment-fix/assets-verification.json y traces-verification.json, ignoradas por Git.

Una primera corrida paralela falló únicamente el umbral de reconstrucción caliente (100,6 ms frente a <100 ms). La repetición sin carga concurrente y la corrida sobre el código final pasaron 60/60 sin cambiar el test.

Estas comprobaciones locales no equivalen a confirmar el empaquetado remoto de Vercel; ese resultado debe comprobarse en el redeploy del commit publicado.

## E2E contra backend real

Chromium desktop y Pixel 7 prueban los mismos seis recorridos:

- Acceso real, Team Builder, importación/exportación, guardado y las cuatro combinaciones OU personalizado/aleatorio por lado. Cada combinación termina naturalmente. Gen 9 Random Battle usa seis Pokémon oficiales por lado y oculta el banquillo rival.
- Explosion provoca debilitamiento y cambio forzado; Pawmot usa Revival Blessing, selecciona Forretress y lo revive conservando el activo. Se comprueban request, estado durable, reanudación, Tera, victoria y replay final.
- Inicio/acciones idempotentes, concurrencia, revisión obsoleta, acción alterada y rendición persistida.
- Rutas privadas sin sesión y API sin autenticación.
- Pérdida de respuesta después de que route.fetch ejecuta la petición real: el retry conserva exactamente ID y decisión y no incrementa dos veces la revisión. No se simula la respuesta del backend.
- Recuperación con OTP generado por Supabase real, callback, cambio de contraseña, cierre de sesión y nuevo acceso. No se envían correos de prueba; la entrega SMTP no se valida con esta prueba.

Playwright usa la UI para configurar/iniciar y comprobar las acciones especiales; el runner completa los restantes turnos mediante APIRequestContext contra la API y Showdown reales. No hay mocks del motor ni del backend en la validación final. Las fixtures unitarias de fallos de red y las fixtures de propiedades SQL no sustituyen estos combates.

## Supabase

Proyecto ihhwihrcsmtyasnrhklx, pokeshowdown, ACTIVE_HEALTHY, PostgreSQL 17. Las diez versiones y SQL locales coinciden con supabase_migrations.schema_migrations, comprobado por lectura MCP.

| Recurso | Verificación |
| --- | --- |
| profiles, teams, battles, battle_actions, battle_replays | RLS activo; lectura limitada al dueño; anon sin privilegios. |
| battle_secrets | RLS activo sin policies, sin privilegios anon/authenticated. Es deliberadamente server-only. |
| Escrituras | Cliente sin INSERT/DELETE de producto; perfil permite solo actualizar display_name. |
| create_battle / commit_battle_turn | Security invoker; EXECUTE solo service_role. |
| Persistencia | Autosave, CAS, unicidad, bloqueo de finalizados, aislamiento de equipos/partidas/replay y secretos probados con cuentas independientes. |

MCP confirmó las diez partidas naturales de la corrida final con checkpoint, acciones guardadas y replay; los E2E comprueban estado/revisión después de cada acción y tras reabrir. Los IDs están en battle-results.json de cada viewport.

| Configuración final | Desktop | Móvil |
| --- | --- | --- |
| OU personalizado / personalizado | Victoria, turno 2 | Victoria, turno 2 |
| OU personalizado / aleatorio | Derrota, turno 2 | Derrota, turno 2 |
| OU aleatorio / personalizado | Victoria, turno 2 | Victoria, turno 2 |
| OU aleatorio / aleatorio | Derrota, turno 10 | Derrota, turno 13 |
| Random Battle oficial | Derrota, turno 16 | Derrota, turno 13 |

Advisors: performance sin avisos. Security informa correctamente de battle_secrets sin policies y avisa de protección contra contraseñas filtradas desactivada. [Información de Supabase sobre esta opción](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se activaron servicios de pago. No se ejecutaron DDL ni borrados remotos; se conservan cuentas y datos QA dedicados.

## Tres ciclos visuales

| Ciclo | Capturas | Revisión y corrección |
| --- | --- | --- |
| 1 | 12 | Desktop/Pixel 7: home, setup, equipos, editor, arena, historial. Corregidos sprites grandes recortados, foco de botón principal y texto Random sin preview. |
| 2 | 14 | Repetición con OU y replay. Sprites contenidos; corregida cabecera desktop del editor para dar espacio a título/nombre. |
| 3 | 21 | Desktop 1440×900, Pixel 7 y móvil 360×640. Editor corregido, arena/acciones/HP/sprites legibles; repetido también con producción. |

Los informes de los tres ciclos devuelven cero errores de consola/red, imágenes fallidas u overflow horizontal. Se inspeccionaron además capturas E2E de cambio forzado, Revival, reanudación, resultado y replay. Las animaciones se ejecutan en las acciones UI antes de aceptar la siguiente request; reduced motion utiliza sprites estáticos. Navegación, controles de replay y acciones tienen destino o comportamiento real.

## Evidencias y operación

- artifacts/visual-review/cycle-1, cycle-2 y cycle-3: capturas e informes JSON.
- artifacts/e2e-final: copia de capturas y resultados, sin credenciales, para conservar evidencias al repetir Playwright.
- test-results: capturas originales, battle-results.json y estados de prueba temporales.
- scripts/review-visuals.mjs: reproduce un ciclo con sesión real y partida propia; genera el informe de imágenes/red/overflow.

Binarios, credenciales, sesiones y assets generados están ignorados por Git. Las capturas se conservan localmente; el informe de validación sí se versiona.

No quedan fallos bloqueantes conocidos del MVP. Para desplegar en otro dominio deben conservarse las variables de entorno y configurar Site URL/redirects de Supabase Auth. La entrega SMTP y la protección opcional de contraseñas filtradas son condiciones de operación externas, no verificaciones cubiertas por el E2E de OTP.
