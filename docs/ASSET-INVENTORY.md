# Inventario de assets

Este documento fija las fuentes y el pipeline de assets del proyecto.

El proyecto es personal y de uso propio. El objetivo de este documento es técnico: saber de dónde se obtiene cada recurso, cómo se sincroniza y qué fallback se utiliza.

## Fuentes fijadas

### Principal: Pokémon Showdown

Base:

https://play.pokemonshowdown.com/sprites/

Usaremos los assets de Showdown como primera opción porque sus IDs encajan naturalmente con el `Dex` que utilizará el motor.

Categorías principales:

| Categoría | Ruta/fuente principal |
| --- | --- |
| Front animated | `/sprites/ani/` |
| Back animated | `/sprites/ani-back/` |
| Shiny front | `/sprites/ani-shiny/` |
| Shiny back | `/sprites/ani-back-shiny/` |
| Sprites por generación | `/sprites/gen*/` |
| HOME renders | `/sprites/home/` |
| HOME centered | `/sprites/home-centered/` |
| HOME shiny | `/sprites/home-shiny/` |
| Mini icons | spritesheets/iconos de Showdown |
| Items | `/sprites/itemicons/` + spritesheet |
| Types | `/sprites/types/` |
| Type icons | `/sprites/typeicons/` |
| Trainers | `/sprites/trainers/` |
| Substitutes | `/sprites/substitutes/` |
| Misc | `/sprites/misc/` |
| Battle backgrounds | `/sprites/gen6bgs/` |
| Battle FX | `/fx/` |

### Fallback: PokéAPI Sprites

Repositorio:

https://github.com/PokeAPI/sprites

Se utilizará cuando falte un asset concreto de la fuente principal o cuando resulte más adecuado para una vista de Pokédex/Team Builder.

No añadir una tercera fuente sin una necesidad concreta.

## Política de consumo

No introducir URLs externas directamente en componentes.

Incorrecto:

```tsx
<img src="https://play.pokemonshowdown.com/sprites/ani/pikachu.gif" />
```

Correcto conceptualmente:

```tsx
<PokemonSprite speciesId="pikachu" side="front" />
```

El componente resuelve un manifest interno generado por el pipeline.

## Estrategia local

Los assets sincronizados se almacenan en:

```text
public/assets/generated/
├── pokemon/
│   ├── animated/
│   ├── animated-back/
│   ├── shiny/
│   ├── shiny-back/
│   ├── home/
│   └── icons/
├── items/
├── types/
├── trainers/
├── battle/
│   ├── backgrounds/
│   └── fx/
├── misc/
└── manifest.json
```

Assets creados específicamente para el proyecto:

```text
public/assets/custom/
```

`public/assets/generated/` no se versiona en Git.

Debe ser reconstruible mediante scripts.

## Scripts previstos

### `sync-assets`

Responsabilidades:

- descargar assets necesarios;
- usar Showdown como fuente principal;
- usar PokéAPI como fallback;
- normalizar nombres;
- mapear formas;
- conservar transparencias;
- generar hashes;
- generar manifest;
- evitar descargas repetidas cuando no cambien;
- generar un resumen de sincronización.

Comando objetivo:

```bash
pnpm sync:assets
```

### `audit-assets`

Responsabilidades:

- recorrer especies/formas soportadas;
- comprobar front/back;
- comprobar shiny;
- comprobar icon;
- comprobar HOME cuando corresponda;
- detectar archivos faltantes;
- detectar archivos huérfanos;
- validar manifest;
- generar reporte.

Comando objetivo:

```bash
pnpm audit:assets
```

## Manifest

Ejemplo conceptual:

```json
{
  "version": 1,
  "showdownRevision": "pinned-revision",
  "species": {
    "pikachu": {
      "front": "/assets/generated/pokemon/animated/pikachu.gif",
      "back": "/assets/generated/pokemon/animated-back/pikachu.gif",
      "shinyFront": "/assets/generated/pokemon/shiny/pikachu.gif",
      "shinyBack": "/assets/generated/pokemon/shiny-back/pikachu.gif",
      "home": "/assets/generated/pokemon/home/pikachu.png"
    }
  }
}
```

El schema definitivo se crea al implementar el pipeline.

## Cobertura necesaria

Para cada especie/forma relevante comprobar:

- front;
- back;
- shiny front;
- shiny back;
- mini icon;
- HOME render cuando se use en UI grande.

No asumir que todas las formas tienen todos los formatos.

## Fallback visual

Orden:

1. asset exacto de Showdown;
2. variante compatible/base;
3. PokéAPI Sprites;
4. icon;
5. placeholder neutral.

El fallback no debe revelar información que el jugador no conozca.

## Pixel art

- evitar escalado fraccional cuando produzca blur;
- preservar transparencia;
- preferir renderizado pixel-perfect cuando el asset lo requiera;
- no convertir por convertir;
- medir tamaño final antes de decidir PNG/WebP/GIF.

## Artwork/HOME

Se puede optimizar para web durante la sincronización:

- resize por uso;
- WebP/AVIF cuando aporte una mejora real;
- conservar el original en caché de sincronización si hace falta;
- no servir imágenes 512x512 en componentes de 32px.

## Backgrounds y FX

Usar Showdown como base inicial:

- `gen6bgs`;
- `fx`.

Más adelante pueden añadirse fondos o efectos propios en `public/assets/custom/`.

## Iconos de UI

Los iconos genéricos de interfaz no tienen por qué provenir de Pokémon Showdown.

Usar una única librería/vector set elegida por el frontend y mantener estilo consistente.

## Datos que no pertenecen aquí

Este documento no decide:

- stats;
- movimientos;
- learnsets;
- legalidad;
- formatos;
- reglas.

Eso se define en `DATA-SOURCES.md`.

## Criterio de completitud

El pipeline de assets se considera preparado cuando:

- puede reconstruir `generated/` desde cero;
- genera manifest;
- muestra assets faltantes;
- Battle UI no usa URLs externas;
- Team Builder no usa URLs externas;
- un asset faltante no rompe la aplicación.
