# PokeShowdown

Proyecto personal de simulación de combates Pokémon. Nombre provisional. **Estado actual: documentación; aún no hay aplicación ni backend implementados.**

## Alcance cerrado

- **Single Player:** contra CPU, con guardado automático al crear la partida y tras cada turno confirmado. Debe poder reanudarse tras cerrar navegador o cambiar de dispositivo.
- **Private Battle:** 1v1 entre dos amigos, mediante sala y código/enlace; sin emparejamiento público ni jugador-host.
- **Formatos iniciales:** Gen 9 OU y Gen 9 Random Battle. «Random Battle» significa equipos aleatorios, no adversarios aleatorios.
- Cuentas, equipos guardados, importación/exportación y validación, historial y replays.

## Tecnología

| Responsabilidad | Decisión |
| --- | --- |
| Aplicación y API serverless | Next.js en Vercel |
| Simulación y CPU | Pokémon Showdown, en Vercel Functions (Node.js) |
| Cuentas, equipos, partidas y replays | Supabase Auth + PostgreSQL |
| Avisos de partidas privadas | Supabase Realtime Broadcast |
| Datos competitivos | Pokémon Showdown |
| Metadatos complementarios | PokéAPI |
| Archivos Pokémon | Showdown; PokéAPI Sprites como fallback |

No hay servidor propio permanente. Las Functions cargan/reconstruyen el combate, procesan la decisión y persisten el resultado; la base de datos es la referencia durable.

La UI todavía no está definida. `docs/DESIGN.md` es el documento vivo donde se registrarán las decisiones visuales a medida que se implementen.

## Configuración

Copiar `.env.example` a `.env.local` y completar las claves del proyecto Supabase. `SUPABASE_SECRET_KEY` es exclusivamente para servidor. No subir secretos reales.

## Documentación

- [Producto](docs/PRODUCT.md): funcionalidades y reglas de los dos modos.
- [Arquitectura](docs/ARCHITECTURE.md): flujo serverless, modelo de datos, concurrencia y pruebas.
- [Diseño](docs/DESIGN.md): reglas y decisiones UI/UX actuales.
- [Fuentes de datos](docs/DATA-SOURCES.md): autoridad competitiva y complementos.
- [Fuentes de assets](docs/ASSET-INVENTORY.md): origen, sincronización y cobertura.

Cada documento es vivo: cualquier cambio en su área debe actualizarlo en la misma tarea.
