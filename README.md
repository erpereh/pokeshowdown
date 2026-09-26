# PokeShowdown

> Nombre provisional del proyecto. La marca pública definitiva se decidirá más adelante.

PokeShowdown es un simulador web de combates Pokémon inspirado en la experiencia competitiva de Pokémon Showdown, con una interfaz propia, moderna y responsive.

El objetivo es reutilizar el motor de simulación y validación de `pokemon-showdown` para no reimplementar las reglas competitivas, mientras que la experiencia de producto, el frontend, el matchmaking, las cuentas, la persistencia y la capa multijugador serán propios.

## Estado

El proyecto se encuentra en **Fase 0: definición y documentación**.

Todavía no existe una aplicación implementada. La arquitectura documentada representa la dirección técnica aprobada para comenzar el desarrollo y debe actualizarse cuando la implementación real difiera.

## Alcance inicial

El primer producto jugable debe incluir:

- cuentas de usuario;
- perfiles básicos;
- Team Builder;
- importación y exportación de equipos;
- validación de equipos mediante Pokémon Showdown;
- combates 1v1 en tiempo real;
- Gen 9 OU;
- Gen 9 Random Battle;
- desafíos privados;
- matchmaking;
- historial básico de combates;
- replays persistentes;
- diseño responsive para escritorio y móvil.

## Principios

1. **Servidor autoritativo.** El cliente nunca decide el resultado de un combate.
2. **No reimplementar mecánicas.** Pokémon Showdown es la referencia para simulación, formatos y legalidad.
3. **Frontend propio.** No copiar código del cliente oficial de Pokémon Showdown.
4. **Separar datos, lógica y presentación.**
5. **Versionar fuentes externas.** Un cambio aguas arriba no debe romper silenciosamente el producto.
6. **Derechos de assets explícitos.** Un asset no se incorpora sin registrar origen y situación de uso.
7. **Mobile-first real.** La interfaz de combate debe ser jugable, no solo visible, en pantallas pequeñas.

## Documentación

- [Producto](docs/PRODUCT.md): alcance, usuarios, funcionalidades y reglas de producto.
- [Arquitectura](docs/ARCHITECTURE.md): arquitectura técnica y decisiones de implementación.
- [Diseño](docs/DESIGN.md): dirección visual, UX y comportamiento responsive.
- [Fuentes de datos](docs/DATA-SOURCES.md): procedencia y prioridad de datos.
- [Inventario de assets](docs/ASSET-INVENTORY.md): catálogo, procedencia, cobertura y derechos.
- [Roadmap](docs/ROADMAP.md): orden de implementación y criterios de salida de cada fase.

## Dependencias externas principales previstas

- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown): simulación, Dex, equipos y validación.
- [PokéAPI](https://pokeapi.co/): datos de presentación complementarios cuando aporten valor.
- [Smogon Sprites](https://github.com/smogon/sprites): referencia/inventario de sprites, sujeto a revisión de derechos.
- [PokéAPI Sprites](https://github.com/PokeAPI/sprites): referencia/inventario adicional de imágenes, sujeto a revisión de derechos.

## Nota sobre propiedad intelectual

Este proyecto no está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, The Pokémon Company, Smogon o Pokémon Showdown.

El código abierto de terceros y los assets de Pokémon tienen situaciones de derechos diferentes. La licencia de un repositorio no debe interpretarse automáticamente como permiso para reutilizar todos los gráficos, marcas, sonidos o personajes contenidos en él.

Antes de una distribución pública relevante se deberá revisar el nombre definitivo, los assets incluidos y las obligaciones de las dependencias de terceros.
