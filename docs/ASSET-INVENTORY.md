# Inventario de assets

Este documento controla qué assets visuales/sonoros necesita el producto, de dónde proceden, qué cobertura tienen y si su uso está aprobado.

## Regla principal

**Que un archivo pueda descargarse públicamente no significa que tengamos permiso para redistribuirlo.**

Ningún asset debe marcarse como `approved` solo porque su repositorio sea open source.

## Estados

- `missing`: no localizado.
- `candidate`: existe una fuente candidata.
- `review`: pendiente de revisar derechos/atribución/calidad.
- `approved`: aprobado para el uso definido.
- `generated`: asset propio generado/creado para el proyecto con procedencia registrada.
- `blocked`: no usar.
- `fallback`: sustituto temporal.

## Fuentes candidatas verificadas

### Smogon Sprites

https://github.com/smogon/sprites

El repositorio indica:

- el **código** del repositorio está bajo MIT;
- los sprites oficiales son propiedad de Nintendo / Game Freak / The Pokémon Company;
- ciertos sprites comunitarios tienen condiciones todavía no completamente determinadas;
- para algunos assets comunitarios recomiendan contactar antes de usarlos.

Conclusión interna: **fuente técnica excelente para inventario/referencia, pero los sprites no se consideran automáticamente aprobados para redistribución.**

### PokéAPI Sprites

https://github.com/PokeAPI/sprites

El repositorio incluye:

- sprites por generaciones;
- front/back;
- shiny;
- icons;
- official artwork;
- Pokémon HOME renders;
- assets de Showdown.

Su `LICENCE.txt` declara CC0 para el repositorio, pero también declara que el contenido de las imágenes tiene copyright de The Pokémon Company.

Conclusión interna: **no interpretar CC0 como cesión de derechos sobre personajes/imágenes de terceros. Revisar antes de redistribuir.**

## Matriz inicial

| Categoría | Necesidad MVP | Fuente candidata | Estado inicial |
| --- | --- | --- | --- |
| Pokémon battle front | Sí | Smogon / PokéAPI | review |
| Pokémon battle back | Sí | Smogon / PokéAPI | review |
| Pokémon shiny front | Sí | Smogon / PokéAPI | review |
| Pokémon shiny back | Sí | Smogon / PokéAPI | review |
| Mini icons | Sí | Smogon / PokéAPI | review |
| Items | Sí | PokéAPI / fuente alternativa | review |
| Iconos de tipos | Sí | propios | generated |
| Iconos UI | Sí | librería compatible / propios | candidate |
| Battle backgrounds | Sí para polish; no para vertical slice | propios | generated |
| Weather overlays | Sí para polish | propios | generated |
| Terrain overlays | Sí para polish | propios | generated |
| Move VFX genéricos | Sí para polish | propios | generated |
| Move VFX 1:1 oficiales | No | — | blocked |
| Sonidos UI | Futuro | propios/licenciados | missing |
| Música oficial | No | — | blocked |
| Logo | Sí antes de lanzamiento | propio | missing |
| Avatares | Sí | propios/licenciados | missing |

`generated` en esta tabla significa **estrategia prevista: crear assets propios**, no que el archivo ya exista.

## Cobertura Pokémon

El manifiesto debe distinguir al menos:

- especie base;
- formas;
- diferencias por género cuando existan;
- shiny;
- front;
- back;
- icon.

No asumir que todos los formatos de asset existen para todas las especies/formas.

## Manifest

Objetivo:

```json
{
  "version": 1,
  "sourceRevision": "example",
  "species": {
    "pikachu": {
      "battleFront": {
        "path": "/assets/pokemon/pikachu/front.webp",
        "status": "approved",
        "source": "source-id"
      }
    }
  }
}
```

El schema real se definirá al implementar el pipeline.

## Estructura objetivo

```text
public/assets/
├── pokemon/
│   ├── battle/
│   └── icons/
├── items/
├── types/
├── battle/
│   ├── backgrounds/
│   ├── weather/
│   ├── terrain/
│   └── effects/
└── brand/
```

No introducir carpetas con miles de assets en Git sin decidir antes estrategia de almacenamiento/CDN y tamaño del repositorio.

## Pipeline de assets

`scripts/sync-assets` deberá:

- leer una lista de fuentes aprobadas;
- descargar/copiar únicamente categorías autorizadas;
- normalizar nombres;
- evitar duplicados;
- convertir a formatos web cuando proceda;
- conservar transparencia;
- no degradar pixel art;
- generar hash;
- registrar fuente;
- generar manifest.

`scripts/audit-assets` deberá:

- recorrer especies/formas soportadas;
- comparar contra manifest;
- comprobar front/back/shiny/icon;
- validar existencia;
- validar dimensiones;
- detectar archivos huérfanos;
- detectar duplicados exactos;
- generar reporte Markdown/JSON;
- fallar CI solo en categorías obligatorias del alcance actual.

## Política de formatos

### Pixel art

Preferencias:

- PNG cuando preservar pixel-perfect/alpha sea prioritario;
- WebP lossless si se valida que no introduce degradación y compensa en tamaño;
- GIF solo si la fuente animada lo requiere inicialmente; preferir pipeline moderno cuando exista alternativa legal/técnica.

### Artwork

- WebP/AVIF derivados solo cuando el derecho de transformación/uso esté claro;
- dimensiones acordes al componente;
- no servir originales gigantes en listas.

### UI

- SVG para iconografía propia o de librerías compatibles;
- evitar rasterizar iconos innecesariamente.

## Fallback

Una ausencia de sprite nunca debe impedir una battle.

Orden conceptual:

1. asset exacto;
2. asset de forma base compatible;
3. icon;
4. placeholder neutral.

El fallback no puede revelar información oculta.

## Requisitos de metadata

Para cada fuente/asset aprobado registrar:

- source name;
- source URL;
- source revision;
- author cuando aplique;
- license;
- copyright/trademark notes;
- attribution requirement;
- modification allowed;
- redistribution allowed;
- commercial-use status;
- date reviewed;
- reviewer/decision notes.

## Lo que no se debe hacer

- hotlink permanente a repositorios externos desde UI de producción;
- descargar imágenes “de Google”;
- mezclar assets sin procedencia;
- asumir que una API concede derechos sobre sus imágenes;
- copiar música/sonidos oficiales;
- crear versiones modificadas de assets si no está claro que se pueden modificar;
- marcar una fuente completa como aprobada cuando solo se revisó una categoría.

## Checklist antes de lanzamiento público

- [ ] Logo y nombre revisados.
- [ ] Cada categoría de asset tiene fuente registrada.
- [ ] No hay assets con estado `review` usados en producción pública sin decisión.
- [ ] Atribuciones incluidas cuando correspondan.
- [ ] No se distribuyen música/sonidos oficiales no autorizados.
- [ ] Se puede reconstruir el manifest.
- [ ] El audit de cobertura pasa para formatos publicados.
- [ ] Los fallbacks funcionan.
- [ ] Se ha hecho una revisión específica de propiedad intelectual/licencias.
