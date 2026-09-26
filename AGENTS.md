# Instrucciones para agentes

## Método

1. Revisar código y documentación **relevantes**, no todos los archivos por defecto.
2. Aplicar cambios mínimos, reutilizar lo existente y no añadir infraestructura preventiva.
3. Mantener documentación y código coherentes. El código es la evidencia de lo implementado; los documentos describen decisiones objetivo mientras no exista implementación.
4. Documentación en español; identificadores de código en inglés.
5. Ejecutar las validaciones disponibles. No declarar completado lo que no se haya verificado.

**Lectura por área:** alcance/reglas → `docs/PRODUCT.md`; servidor/DB → `docs/ARCHITECTURE.md`; Pokémon → `docs/DATA-SOURCES.md`; archivos gráficos → `docs/ASSET-INVENTORY.md`.

## Decisiones que no deben cambiarse sin instrucción

- **Modos:** solo Single Player contra CPU y Private Battle 1v1 por invitación. Random Battle es un formato; no emparejar con desconocidos.
- **Infraestructura:** Next.js/Vercel Functions + Supabase Auth, PostgreSQL y Realtime Broadcast. Sin servicio propio persistente ni jugador-host. El motor `pokemon-showdown` es server-only y usa runtime Node.js, no Edge.
- **Combate:** `BattleStream` resuelve; `Dex`, `Teams` y `TeamValidator` proporcionan datos, equipos y legalidad. No reimplementar mecánicas ni acoplar clientes al protocolo textual interno. Fijar versión del motor.
- **Single Player:** CPU server-side; crear registro recuperable al iniciar; guardar cada turno antes de confirmarlo; reconstruir la última versión confirmada tras cerrar/reabrir. Peticiones repetidas no vuelven a resolverlo.
- **Private Battle:** servidor autoritativo; elecciones privadas, validadas por usuario/battle/request; resolver una sola vez al recibir ambas; persistir antes del aviso Realtime; avisar solo a participantes autorizados.
- **Datos:** Showdown prevalece para combate; PokéAPI solo complementa Pokédex. Assets: Showdown principal, PokéAPI Sprites fallback; sincronizar y generar manifiesto.
- **Seguridad:** RLS en tablas expuestas, autorización backend incluso con clave privilegiada, nada de datos ocultos/elecciones pendientes del rival, ni secretos en el cliente. No confiar en IDs declarados por el navegador.
- **Diseño visual:** pendiente. No crear especificaciones de componentes, estilos, temas, layouts o bibliotecas visuales por iniciativa propia.

## Configuración

`.env.example` es el contrato actual:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Las `NEXT_PUBLIC_*` son públicas; la secret es solo backend. No añadir variables hipotéticas.

## Validaciones específicas

- Comprobar replay/reconstrucción con seed, equipos, input log y versión fijada.
- Probar concurrencia, idempotencia, fallo a mitad de resolución y recuperación de la operación.
- Probar autosave y reanudación tras cerrar la sesión de navegador.
- Probar RLS, autorización de Realtime y filtrado de información del oponente.
- No confundir documentación objetivo con funcionalidades implementadas.
