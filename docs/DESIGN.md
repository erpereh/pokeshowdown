# Diseño

Este documento define **cómo debe verse y comportarse visualmente la aplicación**.

Debe representar la UI/UX **actual**, no ideas futuras. Mientras no exista una decisión visual concreta, dejarla sin definir en lugar de inventarla.

## Regla de mantenimiento

**Cualquier cambio que afecte a UI o UX debe actualizar este archivo en la misma tarea.**

Incluye, entre otros:

- layout y estructura visual;
- colores, temas y tokens;
- tipografía;
- espaciado;
- componentes y variantes;
- responsive;
- navegación visual;
- estados loading/empty/error;
- feedback de interacción;
- animaciones;
- accesibilidad visual;
- iconografía;
- uso de sprites, fondos y efectos dentro de la interfaz.

Si una decisión deja de ser válida, sustituirla o eliminarla. No acumular decisiones obsoletas.

## Estado actual

La dirección visual todavía no está definida.

La única interfaz presente es una página placeholder con el texto «PokeShowdown». `src/app/globals.css` solo importa Tailwind CSS v4. No hay tokens, paleta, tipografía ni layout de producto.

No asumir:

- estilo visual;
- librería de componentes;
- paleta;
- tipografía;
- sistema de diseño;
- layout;
- tema claro/oscuro;
- animaciones;
- comportamiento responsive;

hasta que se decida o exista implementación real.

## Dirección visual

Pendiente.

Cuando se defina, documentar aquí:

- sensación general;
- referencias;
- jerarquía visual;
- nivel de densidad;
- uso de superficies, bordes, sombras y color;
- criterios que deben mantenerse consistentes.

## Sistema visual

Documentar cuando exista:

### Colores y temas

- fondos y superficies;
- texto;
- bordes;
- accent;
- estados;
- colores semánticos;
- reglas light/dark si se incorporan.

### Tipografía

- familias;
- pesos;
- escalas;
- jerarquía;
- usos especiales.

### Espaciado y layout

- anchos;
- grids;
- paddings;
- gaps;
- alineaciones;
- breakpoints;
- comportamiento por viewport.

## Componentes

Cuando se creen componentes visuales:

- reutilizar componentes existentes antes de crear otro patrón;
- documentar componentes compartidos y variantes relevantes;
- mantener consistentes estados hover, focus, active, disabled y loading;
- evitar duplicar componentes que resuelvan el mismo problema;
- actualizar este archivo si aparece una nueva regla reutilizable.

No hace falta listar cada componente trivial: documentar el **sistema y las reglas compartidas**.

## Responsive

Cuando se defina:

- documentar cómo cambia la jerarquía entre desktop y móvil;
- no asumir que móvil es simplemente desktop apilado;
- evitar overflow no intencionado;
- mantener acciones principales utilizables y áreas táctiles adecuadas.

## Animación e interacción

Cuando se incorporen:

- documentar patrones reutilizables;
- mantener duraciones/easing coherentes;
- usar animación para feedback o comprensión, no por defecto;
- respetar `prefers-reduced-motion` cuando aplique.

## Accesibilidad

Toda decisión visual debe preservar:

- contraste suficiente;
- foco visible;
- navegación por teclado cuando corresponda;
- información que no dependa solo del color;
- semántica adecuada;
- controles táctiles utilizables.

## Límites de este documento

- Funcionalidad, reglas y alcance → `PRODUCT.md`.
- Arquitectura e implementación técnica → `ARCHITECTURE.md`.
- Fuentes de datos Pokémon → `DATA-SOURCES.md`.
- Origen/sincronización de assets → `ASSET-INVENTORY.md`.

Este archivo no debe contener funcionalidades ni arquitectura salvo el mínimo contexto necesario para explicar una decisión visual.
