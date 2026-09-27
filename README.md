# PokeShowdown

MVP PvE para combatir contra una CPU con el simulador oficial de Pokémon Showdown. Equipos, partidas, historial y replays viven en Supabase. No incluye multijugador.

## Funcionalidades

- Gen 9 OU: equipo personalizado o aleatorio elegido independientemente para jugador y CPU.
- Gen 9 Random Battle: generador oficial del motor, sin Team Preview.
- Team Builder con seis slots, importación/exportación Showdown, validación, borradores y duplicación.
- Movimientos, cambios voluntarios/forzados, Teracristalización, Revival Blessing, estados, clima/campo y rendición.
- Autosave en servidor, reanudación al cerrar/reabrir, historial y replay con controles.
- Supabase Auth: registro, confirmación, acceso, recuperación/cambio de contraseña y cierre de sesión.

## Instalación

Node.js >=22 y pnpm 10.34.5.

```bash
pnpm install --frozen-lockfile
pnpm sync:assets --profile=runtime
pnpm audit:assets
pnpm verify:engine
pnpm typecheck
pnpm dev
```

Los assets generados están ignorados por Git. El perfil runtime descarga los recursos usados por la UI de Gen 9; --profile=full es opcional. pnpm sync:data regenera los nombres complementarios en español, ya versionados. PokéAPI no interviene en la simulación.

## Configuración

Completar .env.local desde .env.example con las variables del proyecto Supabase existente:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY — exclusivamente servidor.

No subir claves ni sesiones. En Supabase Auth configurar la URL del sitio y permitir http://localhost:3000/auth/confirm y su equivalente desplegado. El callback admite token_hash/type o code PKCE; la recuperación dirige a /auth/update-password.

supabase/migrations contiene el historial aplicado, con las mismas versiones y orden. La entrada inicial registra el baseline histórico; las siguientes contienen tablas, funciones, RLS y restricciones. No repetirlo sobre un proyecto ya migrado ni resetear la base.

Vercel conserva el build pnpm sync:assets --profile=runtime && pnpm build. No necesita servidor permanente ni servicios de pago.

## Validación

```bash
pnpm typecheck
pnpm test
pnpm verify:engine
pnpm build
pnpm test:e2e
git diff --check
```

Persistencia y E2E requieren el backend real configurado. Usan cuentas dedicadas, conservan los datos de prueba y no borran usuarios ni partidas. Credenciales/sesiones y capturas temporales viven bajo directorios ignorados. Los combates finales no se sustituyen por respuestas simuladas.

## Documentación

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Diseño](docs/DESIGN.md)
- [Fuentes de datos](docs/DATA-SOURCES.md)
- [Assets](docs/ASSET-INVENTORY.md)
- [Validación del MVP](docs/VALIDATION.md)
