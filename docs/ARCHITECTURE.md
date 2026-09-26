# Arquitectura serverless

**Estado:** objetivo técnico aprobado; aún no existe aplicación ni esquema desplegado. Meta: funcionar en planes gratuitos mientras el uso encaje en sus cuotas, sin proceso propio encendido 24/7.

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

### Estructura prevista, solo cuando se necesite

```text
apps/web/app/api/{battles,rooms,teams}/
packages/{battle-engine,battle-contract,pokemon-data,supabase}/
scripts/{sync-data,sync-assets,audit-assets}/
docs/
```

No crear paquetes vacíos ni infraestructura adicional preventivamente. Las decisiones visuales quedan fuera de este documento.

## Modelo de datos conceptual

| Tabla | Campos/propósito principales |
| --- | --- |
| `profiles` | `user_id`, nombre visible, timestamps. |
| `teams` | `id`, `owner_id`, `format_id`, equipo canónico, `engine_version`, timestamps. |
| `battle_rooms` | Host, código de invitación, formato, estado, caducidad. |
| `battles` | ID, modo (`singleplayer`/`private`), formato, versión de motor, seed, turno, status, ganador, referencia a log canónico, revisión/timestamps. |
| `battle_players` | Lado, usuario (nullable para CPU) y snapshot de equipo protegido. |
| `battle_choices` | Battle/turno/lado/request, elección y estado; clave única para evitar duplicación. |
| `battle_replays` | Log de reproducción, versión y metadatos. |

Separar datos canónicos privados de vistas accesibles al cliente. Toda tabla expuesta con datos de usuario requiere RLS; la autorización de sala/participación se verifica también en backend.

## Motor y reconstrucción

El estado durable incluye, como mínimo, `engine_version + seed + equipos iniciales + input log canónico + estado/turno`. La implementación debe comprobar mediante tests que reconstruir una battle con **la misma versión** reproduce exactamente el estado y el request actual. No serializar objetos internos del motor ni prometer compatibilidad de reproducción entre versiones distintas; conservar suficiente log de eventos para ver replays históricos.

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

Unit: contratos, CPU, normalización y filtrado. Integración: motor/reproducción determinista, legalidad, autosave, concurrencia/recuperación de claim y RLS. E2E: login, equipos, Single Player con cierre/reanudación, sala privada con dos sesiones, retries, historial y replay.

## Configuración

`.env.example` es el único contrato actual:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Las dos primeras claves pueden ir al navegador; la tercera nunca. No introducir más variables hasta que sean necesarias.
