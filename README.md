# PokeShowdown

> Nombre provisional del proyecto. La marca definitiva se decidirá más adelante.

PokeShowdown es un proyecto personal para crear un simulador web de combates Pokémon inspirado en Pokémon Showdown, con frontend propio, Team Builder, partidas individuales contra CPU y partidas privadas 1v1 entre dos amigos.

## Estado

El proyecto está en fase de definición técnica y documentación. Todavía no existe una aplicación implementada.

## Arquitectura fijada

El proyecto no tendrá un servidor de juego persistente propio.

- **Frontend y backend serverless:** Next.js desplegado en Vercel.
- **Motor de combate:** Pokémon Showdown ejecutado únicamente en Vercel Functions con runtime Node.js.
- **Autenticación y base de datos:** Supabase Auth + PostgreSQL.
- **Sincronización multijugador:** Supabase Realtime Broadcast.
- **Persistencia:** Supabase.
- **Datos competitivos:** Pokémon Showdown.
- **Datos complementarios de Pokédex:** PokéAPI.
- **Assets principales:** Pokémon Showdown.
- **Assets fallback:** PokéAPI Sprites.

Vercel Functions se invocan solo cuando hay trabajo que realizar. No existe un proceso Node propio que deba permanecer encendido.

## Modos de juego

### Single Player

El jugador combate contra una CPU.

Flujo:

1. el navegador envía la decisión del jugador a una Vercel Function;
2. la Function reconstruye/carga la battle;
3. la CPU genera una decisión legal;
4. Pokémon Showdown resuelve el turno;
5. el estado canónico necesario para continuar se guarda en Supabase;
6. la respuesta devuelve la vista actualizada al jugador.

**La partida se guarda después de cada turno resuelto.**

Si el navegador se cierra, el usuario puede volver más tarde y continuar desde el último turno persistido.

### Private Battle

Dos usuarios juegan mediante una sala privada con código o enlace.

Flujo:

1. un usuario crea una sala;
2. el segundo usuario se une;
3. cada jugador envía su decisión a una Vercel Function;
4. las decisiones se almacenan de forma privada;
5. cuando existen ambas decisiones, una única resolución procesa el turno con Pokémon Showdown;
6. Supabase persiste el resultado del turno;
7. Supabase Realtime Broadcast notifica a ambos clientes;
8. cada cliente obtiene únicamente la información que puede ver.

No se utiliza un jugador como host de la partida.

> "Random Battle" se refiere al formato con equipos generados por Pokémon Showdown, no a emparejar jugadores aleatorios.

## Responsabilidades

### Vercel

- servir la aplicación Next.js;
- ejecutar Route Handlers / Functions;
- ejecutar Pokémon Showdown;
- validar equipos;
- resolver turnos;
- ejecutar la CPU;
- aceptar decisiones privadas;
- reconstruir battles desde su estado persistido;
- persistir resultados en Supabase.

### Supabase

- Auth y sesiones;
- perfiles;
- equipos guardados;
- salas privadas;
- battles activas;
- autosave de Single Player;
- decisiones privadas multijugador;
- historial;
- replays;
- Realtime Broadcast;
- RLS y autorización de datos.

### Pokémon Showdown

- simulación;
- RNG;
- reglas;
- formatos;
- legalidad;
- TeamValidator;
- Teams;
- Random Battles;
- Dex.

## Alcance inicial

- cuentas de usuario;
- perfil básico;
- Team Builder;
- importación/exportación;
- validación;
- Gen 9 OU;
- Gen 9 Random Battle;
- Single Player contra CPU;
- Private Battle 1v1 mediante código/enlace;
- guardado y reanudación;
- historial;
- replays;
- light/dark;
- escritorio y móvil.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` es exclusivamente server-side y nunca debe llegar al navegador.

## Documentación

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Diseño](docs/DESIGN.md)
- [Fuentes de datos](docs/DATA-SOURCES.md)
- [Inventario de assets](docs/ASSET-INVENTORY.md)

## Fuentes fijadas

- Pokémon Showdown: https://github.com/smogon/pokemon-showdown
- Assets Showdown: https://play.pokemonshowdown.com/sprites/
- PokéAPI: https://pokeapi.co/
- PokéAPI Sprites: https://github.com/PokeAPI/sprites
- Supabase: https://supabase.com/
- Vercel: https://vercel.com/
