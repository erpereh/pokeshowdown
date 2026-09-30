# Diseño

PokeShowdown se presenta como una Pokédex moderna y clara con identidad de juego Pokémon, no como una web. El diseño prioriza jugar en móvil vertical con el pulgar; desktop conserva más espacio para arena, editor y registro.

## Sistema visual

Fredoka (redondeada) para marca, títulos, botones y HUD; Nunito para texto y formularios, mediante next/font. Tokens en globals.css: fondo gris azulado muy claro, superficies blancas, texto pizarra, rojo Poké Ball para la acción principal, azul para selección/foco y un azul marino (`battle-frame`) para los marcos del combate. HP, tipos y estados mantienen colores semánticos y etiquetas. Radios de 16 px en controles, 24–32 px en tarjetas y hojas; sombras suaves difusas, sin cristal ni desenfoque.

Cada tipo tiene dos paletas en `TypeChip.tsx`: la oficial para chips sólidos (texto AA) y `TYPE_CARD_COLORS` para fondos de tarjeta con título blanco (contraste ≥3:1 de texto grande, cubierto por test). Las tarjetas de color (`type-card`, `Card type=…`) llevan una Poké Ball decorativa (máscara CSS `pokeball-deco`), chips translúcidos (`soft-pill`, `TypeChip tone="soft"`) y sprite oficial grande; las hojas blancas (`sheet-surface`) se solapan sobre la cabecera de color como la ficha de Pokédex.

Patrones compartidos: GameButton (píldoras), Card/PokeballDeco/Pokeball, SegmentedControl como pestañas subrayadas con indicador animado, Modal/Sheet (renderizados en body), chips, HpBar con etiqueta PS, Icon, ToolMenu/ToolButton (acciones secundarias plegables en celdas compactas iguales con icono y etiqueta corta), toasts y estados de carga/error/vacío con Poké Ball. Los títulos de pantalla no llevan etiquetas pequeñas encima.

## Navegación y pantallas

- Cinco destinos en el orden Amigos, Equipos, Jugar, Partidas e Historial. Por debajo de 1024 px, barra inferior blanca anclada con safe area; Jugar ocupa la columna central como Poké Ball elevada sin borde ni sombra y el destino activo se marca en rojo con indicador. Desde 1024 px, pestañas en píldora en la cabecera. Marca y cuenta permanecen accesibles. Amigos es una pantalla vacía con su título.
- Inicio sin sesión (`/`): tarjeta roja con Garchomp vs Dragapult y Entrar/Crear cuenta, más una tarjeta informativa. Con sesión, `/` lleva a Jugar.
- Jugar (pantalla principal): título, tarjeta roja compacta con Garchomp vs Dragapult, tarjeta Continuar partida cuando existe, «Elige formato» con formatos como tarjetas grandes de color con sprite; selección de equipos OU por lado con pestañas en móvil; Comenzar combate fijo sobre la navbar en móvil/tablet y sticky en desktop.
- Equipos: tarjetas coloreadas por el tipo del primer Pokémon con sprite líder, formato, legalidad y bandeja blanca con los seis sprites y acciones; botón flotante azul + en móvil.
- Editor: ranuras como mini tarjetas por tipo; ficha de Pokémon con cabecera de color (nombre, número, tipos, tier, sprite) y hoja blanca con pestañas Pokémon, Set y Entrenamiento en móvil. Los campos permanecen montados y el borrador conserva valores. Guardar y Validar en una fila compacta; Aleatorio, Importar y Exportar, y las acciones de cada Pokémon, en ToolMenu. Estadísticas finales en barras estilo Pokédex coloreadas por naturaleza.
- Partidas/Historial: tarjetas blancas con sprites enfrentados (VS), formato, turno, fecha y chip de resultado.
- Acceso y recuperación: tarjeta blanca sobre fondo claro con Poké Balls decorativas; campos de 16 px para evitar zoom.

## Combate y replay

Shell de altura 100dvh sin navbar inferior. Barra superior con píldora de turno, clima/campo, velocidad y bandera de rendición. Arena con fondos locales de combate, plataformas elípticas, rival de frente y jugador de espalda; cajas HP blancas con marco marino y esquinas asimétricas (nombre, género, nivel, barra PS, PS exactos solo propios, estado, Tera, cambios y Poké Balls del equipo). Arena móvil `clamp(210px, 44dvh, 400px)`; el panel de controles es una hoja blanca que se solapa sobre la arena con scroll interno. En landscape bajo, arena y controles lado a lado. Desktop añade el registro en una tarjeta lateral.

La caja de narración (borde doble estilo juego) muestra con efecto máquina de escribir la última línea del registro o «¿Qué debería hacer X?» cuando se espera una elección; al tocarla abre el registro completo en Sheet.

- Menú raíz 2×2: Luchar (rojo), Pokémon (verde), Teracristalizar (color del tipo Tera, deshabilitado si no aplica; activa Tera y abre los movimientos) y Huir (abre la confirmación de rendición). Cada submenú tiene botón Atrás; la request nueva vuelve al menú.
- Movimientos en cuadrícula 2×2 con tarjeta del color del tipo, nombre, tipo, categoría y PP; botón ⓘ independiente abre detalles en Sheet sin enviar elección. Con Tera activo los movimientos se resaltan y un conmutador permite desactivarlo.
- La request vigente determina preview, menú, cambio forzado o espera; Revival explica la selección de debilitados. Envío/reproducción bloquean elecciones; fallo de respuesta reintenta la misma acción.
- Rendición pide confirmación. El resultado es una ficha con cabecera verde/roja/azul/gris, sprite, confeti en victoria y Revancha/Ver repetición/Inicio. Replay ofrece anterior/reproducir/siguiente, velocidad y turno. Nunca se presentan datos ocultos del rival.

## Animación, accesibilidad y validación

Movimiento solo con transform/opacity: entrada de página por opacidad (no atrapa elementos fijos), entradas escalonadas en listas, pop-in de tarjetas y movimientos, hojas que suben con resorte, indicador de pestañas deslizante, Poké Balls decorativas girando lento, rebote de la Poké Ball de Jugar, flotación de sprites decorativos, barras de estadísticas que crecen, sprites y cajas HP que entran deslizándose, transición lateral entre submenús, confeti en victoria y sacudida en errores/derrota. Las animaciones de entrada usan `fill-mode: backwards` para no bloquear los estados :hover/:active. El director reproduce eventos confirmados; la autoridad no depende de animaciones. Se mantienen 1×/2× y omitir; ocultar pestaña detiene reproducción. prefers-reduced-motion anula animaciones CSS, la máquina de escribir y usa sprites estáticos.

Controles táctiles de al menos 48 px, nombre accesible, foco visible azul y disabled correcto. Modales/sheets contienen foco, lo restauran y permiten Escape. Selectores soportan teclado (combate: F, 1–4, T, S, Esc). Iconos decorativos no repiten nombres. La información no depende solo del color.

Validar 320, 390 y 430 px, tablet, desktop, landscape, formularios con teclado móvil y viewports cortos. Revisar capturas de inicio, setup, equipos, editor, combate (menú, movimientos, cambio, Revival, resultado) y replay. Comprobar imágenes, consola, red y ausencia de overflow horizontal y controles solapados. E2E cubre foco, persistencia de campos entre secciones y consulta de detalles sin resolver turnos.
