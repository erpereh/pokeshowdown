# PokeShowdown

> Nombre provisional del proyecto. La marca definitiva se decidirá más adelante.

PokeShowdown es un proyecto personal para crear un simulador web de combates Pokémon inspirado en Pokémon Showdown, con frontend propio, Team Builder, matchmaking, cuentas, historial y una experiencia visual moderna y responsive.

## Estado

El proyecto está en fase de definición técnica y documentación. Todavía no existe una aplicación implementada.

## Decisiones fijadas

- **Motor de combate:** Pokémon Showdown.
- **Frontend:** propio, desacoplado del cliente oficial de Pokémon Showdown.
- **Base de datos y autenticación:** Supabase.
- **Persistencia:** PostgreSQL de Supabase.
- **Tiempo real de batalla:** game server propio con WebSockets.
- **Datos competitivos:** Pokémon Showdown como fuente principal.
- **Datos complementarios de Pokédex:** PokéAPI.
- **Assets principales:** Pokémon Showdown / Play Pokémon Showdown.
- **Assets fallback:** PokéAPI Sprites.
- **Assets sincronizados localmente:** no se hará hotlink desde la UI.

## Responsabilidades principales

### Pokémon Showdown

- simulación de combates;
- formatos;
- reglas;
- legalidad;
- TeamValidator;
- import/export de equipos;
- Random Battles;
- datos competitivos mediante Dex.

### Supabase

- registro e inicio de sesión;
- sesiones de usuario;
- perfiles;
- equipos guardados;
- historial de combates;
- resultados;
- replays persistentes;
- preferencias;
- ratings/estadísticas cuando se implementen.

Supabase **no resuelve los combates ni mantiene el estado vivo de una battle**.

### Game server

- WebSockets;
- matchmaking;
- desafíos;
- battles activas;
- reconexión;
- timeouts;
- autorización de decisiones;
- integración con Pokémon Showdown;
- persistencia hacia Supabase.

## Alcance inicial

- cuentas de usuario;
- perfiles básicos;
- Team Builder;
- importación/exportación;
- validación;
- Gen 9 OU;
- Gen 9 Random Battle;
- combates 1v1;
- matchmaking;
- desafíos privados;
- reconexión;
- historial;
- replays;
- light/dark;
- escritorio y móvil.

## Documentación

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Diseño](docs/DESIGN.md)
- [Fuentes de datos](docs/DATA-SOURCES.md)
- [Inventario de assets](docs/ASSET-INVENTORY.md)

## Fuentes externas fijadas

- Pokémon Showdown: https://github.com/smogon/pokemon-showdown
- Assets de Showdown: https://play.pokemonshowdown.com/sprites/
- PokéAPI: https://pokeapi.co/
- PokéAPI Sprites: https://github.com/PokeAPI/sprites
- Supabase: https://supabase.com/

## Configuración

Copiar:

```bash
cp .env.example .env.local
```

y rellenar las credenciales del proyecto Supabase cuando se cree.

Nunca subir secretos reales al repositorio.
