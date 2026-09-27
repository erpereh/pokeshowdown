# PokeShowdown

Proyecto personal de simulación de combates Pokémon. Nombre provisional. **Estado actual: motor, recursos locales y shell Next.js listos; la interfaz es un placeholder. Aún no hay autenticación, salas ni combate jugable.**

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

## Instalación

Requiere Node.js 22 o superior y pnpm 10. Desde la raíz:

```bash
pnpm install
pnpm sync:data
pnpm sync:assets
pnpm audit:assets
pnpm verify:engine
pnpm typecheck
pnpm dev
```

`pnpm sync:assets` descarga los sprites a `public/assets/generated/` (no se versionan). Una segunda ejecución no vuelve a bajar los archivos que ya coinciden. `pnpm sync:data` regenera `data/complement/es.json`. `pnpm verify:engine` comprueba Dex, Teams, TeamValidator y una batalla mínima con BattleStream. `pnpm dev` arranca Next.js. `pnpm build` ejecuta `next build`.

En un despliegue limpio de Vercel el build es `pnpm sync:assets && pnpm build` (framework Next.js, sin `outputDirectory`).

## Configuración

Copiar `.env.example` a `.env.local` y completar las claves del proyecto Supabase. `SUPABASE_SECRET_KEY` es exclusivamente para servidor. No subir secretos reales. El motor y los assets no necesitan variables nuevas.

## Documentación

- [Producto](docs/PRODUCT.md): funcionalidades y reglas de los dos modos.
- [Arquitectura](docs/ARCHITECTURE.md): flujo serverless, modelo de datos, concurrencia y pruebas.
- [Diseño](docs/DESIGN.md): reglas y decisiones UI/UX actuales.
- [Fuentes de datos](docs/DATA-SOURCES.md): autoridad competitiva y complementos.
- [Fuentes de assets](docs/ASSET-INVENTORY.md): origen, sincronización y cobertura.

Cada documento es vivo: cualquier cambio en su área debe actualizarlo en la misma tarea.
