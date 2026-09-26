# Diseño

Este documento define la dirección de UI/UX del producto.

## Estado

Todavía no existe interfaz implementada. Este documento representa la dirección visual aprobada para la primera versión.

La marca, logotipo y nombre definitivo están pendientes, por lo que el sistema visual debe evitar depender de un branding difícil de sustituir.

## Dirección visual

La aplicación debe sentirse:

- competitiva;
- moderna;
- rápida;
- limpia;
- visual sin sacrificar legibilidad;
- inspirada en un videojuego, no en un dashboard empresarial;
- reconocible sin copiar la interfaz de Pokémon Showdown ni la de los juegos oficiales.

El objetivo no es “hacer Showdown bonito”, sino construir una experiencia propia alrededor de un motor competitivo fiable.

## Principios

### La batalla es el centro

Durante un combate, todo elemento compite por atención con una decisión limitada en tiempo. El escenario, sprites y animaciones apoyan la experiencia pero nunca deben dificultar leer HP, estados, clima, turnos u opciones.

### Densidad controlada

Es una herramienta competitiva y necesita mucha información, pero debe presentarse por capas:

1. decisión actual;
2. estado de campo;
3. información del Pokémon;
4. detalles avanzados bajo demanda;
5. log completo en panel secundario.

### Consistencia

Un mismo concepto debe verse y comportarse igual en Battle, Team Builder y Pokédex.

### Velocidad percibida

La UI debe responder inmediatamente a clicks/teclado aunque el servidor aún esté procesando, diferenciando claramente estado “seleccionado/enviado” de “confirmado por servidor”.

## Temas

Se soportarán:

- dark;
- light;
- preferencia del sistema.

Dark será una experiencia de primera clase, no una inversión automática de colores.

## Tokens

No fijar una paleta de marca permanente hasta decidir nombre/identidad.

Definir tokens semánticos:

- `--background`
- `--surface`
- `--surface-raised`
- `--text-primary`
- `--text-secondary`
- `--border`
- `--accent`
- `--accent-contrast`
- `--success`
- `--warning`
- `--danger`
- `--focus-ring`

Los colores de tipos Pokémon son datos semánticos independientes del tema y deben pasar comprobaciones de contraste cuando se usen con texto.

## Tipografía

Dirección:

- sans-serif moderna y muy legible para UI;
- números tabulares donde ayuden a comparar stats;
- pesos limitados para evitar ruido;
- headings compactos;
- nombres, HP y acciones deben poder leerse en un vistazo.

No usar una tipografía decorativa de “videojuego” como fuente principal.

## Layout global

Desktop:

- navegación compacta;
- contenido principal centrado con ancho adaptable;
- paneles laterales solo cuando aporten información accionable;
- aprovechar horizontalidad en Battle y Team Builder.

Mobile:

- navegación reducida;
- acciones críticas en zona inferior accesible al pulgar;
- paneles secundarios como sheets/drawers;
- evitar layouts que dependan de hover.

## Battle UI

### Desktop objetivo

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: formato · jugadores · turno · timer                │
├───────────────────────────────────────────┬──────────────────┤
│                                           │ Battle log       │
│              Battle stage                 │ / details        │
│                                           │                  │
├───────────────────────────────────────────┴──────────────────┤
│ Pokémon activo · HP · status · boosts                        │
│ [Move 1] [Move 2] [Move 3] [Move 4]     [Switch / Team]    │
└──────────────────────────────────────────────────────────────┘
```

El stage debe tener jerarquía visual, pero los controles de decisión son más importantes que la decoración.

### Mobile objetivo

```text
┌───────────────────────┐
│ rival + team + timer  │
│                       │
│     battle stage      │
│                       │
│ jugador + HP/status   │
├───────────────────────┤
│ decisiones            │
│ 2 columnas / lista    │
├───────────────────────┤
│ team · log · detalles │
└───────────────────────┘
```

El log no debe ocupar permanentemente media pantalla en móvil.

### Movimientos

Cada movimiento debe poder mostrar de forma consistente:

- nombre;
- tipo;
- categoría cuando aporte valor;
- PP;
- potencia/precisión cuando proceda;
- estado disabled;
- feedback de selección;
- detalles en tooltip/popover o panel táctil.

No usar únicamente color de tipo para identificar el tipo.

### HP y estados

- HP visual + información textual permitida;
- animación de cambio rápida y legible;
- no interpolar de forma que parezca un valor distinto al confirmado;
- estados con icono/abreviatura y texto accesible;
- boosts consultables sin invadir la pantalla.

### Información oculta

La UI jamás debe inferir o enseñar:

- movimientos no revelados;
- objeto no revelado;
- habilidad no revelada;
- stats internos no permitidos;
- cualquier dato que el servidor haya clasificado como privado.

## Team Builder

Desktop:

- lista de equipos;
- lista de seis slots;
- editor principal;
- búsqueda rápida;
- panel de stats/validación.

Mobile:

- navegación por slots;
- edición por secciones;
- summary fijo/compacto;
- guardado y validación siempre accesibles.

### Editor de Pokémon

Orden recomendado:

1. especie/forma;
2. objeto;
3. habilidad;
4. movimientos;
5. naturaleza;
6. EVs;
7. IVs;
8. opciones avanzadas.

Las búsquedas deben soportar teclado y ser rápidas con catálogos grandes.

### Validación

Los errores deben:

- identificar slot/campo cuando sea posible;
- explicar el problema en lenguaje entendible;
- conservar el mensaje técnico original solo como detalle si ayuda;
- no borrar cambios del usuario.

## Pokédex / selectores

Los selectores reutilizan el mismo patrón:

- search;
- filtros;
- virtualización si el volumen lo requiere;
- navegación con teclado;
- icono/sprite opcional;
- metadatos mínimos relevantes.

No crear un selector diferente para species, moves, abilities e items si un patrón común resuelve los cuatro.

## Cards

Evitar llenar todas las pantallas de cards.

Usarlas cuando exista una unidad real con:

- identidad;
- límites;
- acción;
- agrupación semántica.

No usar cards solo para añadir fondo, sombra y padding.

## Iconografía

- consistente;
- preferir iconos vectoriales para UI genérica;
- no mezclar cinco estilos;
- todo icono interactivo necesita nombre accesible/tooltip cuando no sea obvio.

## Sprites y artwork

La batalla debe funcionar incluso si un asset falta.

Fallback:

1. sprite preferido;
2. alternativa compatible;
3. icono/placeholder neutral.

No deformar sprites pixel art mediante filtros o escalado fraccional cuando el estilo requiera pixel-perfect.

La procedencia, fuente, cobertura y fallback se gestionan en `ASSET-INVENTORY.md`.

## Escenarios

Objetivo futuro del MVP visual:

- fondos propios o con uso autorizado;
- capas discretas para clima/terreno;
- contraste suficiente con sprites;
- no incorporar texto importante dentro del fondo.

No son requisito para hacer funcionar el primer vertical slice.

## Animaciones

Usar animaciones para:

- entrada/cambio;
- daño/curación;
- faint;
- estados;
- selección;
- cambio de turno;
- clima/campo;
- feedback de conectividad.

Reglas:

- duración corta;
- nunca bloquear decisiones más tiempo del necesario;
- los datos confirmados por servidor tienen prioridad sobre la animación;
- respetar `prefers-reduced-motion`;
- ofrecer una experiencia coherente con animaciones reducidas.

No es objetivo inicial recrear cada animación de ataque de los juegos oficiales.

## Sonido

Fuera del primer vertical slice.

Si se añade:

- mute global;
- volumen;
- no autoplay agresivo;
- assets integrados mediante el pipeline definido;
- señales útiles, no ruido constante.

## Feedback de red

Estados obligatorios:

- conectado;
- reconectando;
- desconectado;
- decisión pendiente de envío;
- decisión aceptada/rechazada.

Una pérdida de conexión nunca debe parecer que el botón simplemente “no funciona”.

## Estados vacíos y errores

Todo flujo importante debe tener:

- loading;
- empty;
- error;
- retry;
- offline/reconnecting cuando aplique.

Los errores técnicos no se mostrarán directamente si no ayudan al jugador.

## Accesibilidad

Objetivos mínimos:

- WCAG AA como referencia práctica;
- foco visible;
- navegación por teclado;
- labels accesibles;
- áreas táctiles adecuadas;
- contraste;
- no depender solo de color;
- reduced motion;
- semántica correcta;
- announcements para cambios relevantes de batalla sin convertir el lector de pantalla en un log inusable.

## Responsive

Breakpoints por necesidad de layout, no por dispositivo específico.

Probar como mínimo:

- móvil estrecho;
- móvil grande;
- tablet;
- portátil;
- escritorio amplio.

La batalla debe ser jugable en landscape y portrait cuando el viewport lo permita.

## Rendimiento visual

- no cargar artwork de alta resolución donde basta un icono;
- lazy-load de contenido no crítico;
- evitar layout shift al cargar sprites;
- animaciones basadas en propiedades eficientes;
- listas grandes virtualizadas cuando sea necesario.

## Evitar

- copiar visualmente Pokémon Showdown;
- glassmorphism como lenguaje principal;
- gradientes por defecto en cada superficie;
- neon excesivo;
- sombras pesadas;
- cards anidadas;
- blur costoso;
- microanimaciones en todo;
- información importante solo en hover;
- estilos que dependan del nombre provisional PokeShowdown.

## Criterio de aceptación visual del MVP

El MVP visual está listo cuando:

- Battle y Team Builder son utilizables sin instrucciones;
- dark y light mantienen contraste y jerarquía;
- no hay overflow horizontal no intencionado;
- acciones principales caben y funcionan en móvil;
- estados de red son comprensibles;
- la UI sigue siendo usable sin animaciones;
- assets faltantes no rompen el layout;
- Playwright cubre los flujos visuales críticos y se revisan screenshots en viewports representativos.
