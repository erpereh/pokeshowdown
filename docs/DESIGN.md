# Diseno

Este documento define COMO debe verse y sentirse la aplicacion.

Debe representar la direccion visual, UI y UX ACTUAL.

## Direccion visual

Describir como debe sentirse visualmente el producto.

- minimalista
- moderno
- limpio
- premium
- tecnico
- accesible

## Principios de diseno

- El contenido debe tener mas importancia que la decoracion.
- Mantener una jerarquia visual clara.
- Priorizar consistencia frente a novedad.
- Reutilizar patrones visuales existentes.
- Evitar complejidad visual innecesaria.
- No introducir estilos que entren en conflicto con el resto del producto.
- No inventar nuevos patrones visuales si ya existe uno equivalente.

## Colores

- Background:
- Surface:
- Primary text:
- Secondary text:
- Border:
- Accent:

## Tipografia

Documentar fuentes, pesos, tamanos, jerarquia y reglas de uso.

## Layout

Documentar cuando sea relevante:

- ancho maximo
- paddings
- grids
- separacion entre secciones
- alineaciones
- uso del espacio negativo

## Componentes

- Reutilizar componentes existentes antes de crear nuevos.
- Evitar variantes duplicadas sin una razon clara.
- Mantener consistentes los estados hover, focus, active y disabled.
- Evitar envolver contenido en cards o contenedores sin necesidad.
- No crear componentes visualmente distintos para resolver el mismo patron.

## Responsive

- Disenar intencionadamente para distintos tamanos de pantalla.
- No limitarse a apilar en movil el layout de escritorio.
- Replantear jerarquia, espacios, navegacion y CTAs en pantallas pequenas.
- Evitar overflow horizontal.
- Mantener areas tactiles adecuadas.

## Animaciones

- Las animaciones deben apoyar la interaccion, jerarquia o narrativa visual.
- Evitar animacion puramente decorativa salvo que forme parte de la direccion del producto.
- Mantener duraciones y easing consistentes.
- Reutilizar el sistema de animaciones existente.
- Respetar `prefers-reduced-motion` cuando sea aplicable.

## Accesibilidad

- Mantener contraste suficiente.
- Mantener estados de foco visibles.
- No depender exclusivamente del color para comunicar informacion.
- Mantener semantica y navegacion por teclado cuando corresponda.

## Evitar

- exceso de cards
- exceso de gradientes
- glassmorphism innecesario
- bordes decorativos sin funcion
- animaciones excesivas
- estilos genericos que no encajen con el producto

## Notas

Este archivo describe la experiencia visual ACTUAL.

La funcionalidad pertenece a `PRODUCT.md`.

La implementacion tecnica pertenece a `ARCHITECTURE.md`.
