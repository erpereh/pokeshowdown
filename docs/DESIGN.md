# Diseño

PokeShowdown usa una identidad de videojuego oscura y premium con liquid glass. El diseño prioriza jugar en móvil vertical; desktop conserva más espacio para arena, editor y registro.

## Sistema visual

Outfit para marca, títulos y acciones; Manrope para texto/formularios, mediante next/font. Tokens en globals.css: negro azulado, blanco, gris frío, cian para selección y dorado para la acción principal. HP, tipos y estados mantienen colores semánticos y etiquetas. Radios de 18 px en controles y 28 px en paneles; transiciones de interfaz de 140–220 ms.

GameButton, GlassPanel, SegmentedControl, Modal/Sheet, chips, HP, Icon, notificaciones y estados de carga/error/vacío son patrones compartidos. El cristal combina transparencia, reflejo superior, bordes suaves y desenfoque estático. Formularios, HUD y datos densos usan mayor opacidad. Sin backdrop-filter o con prefers-reduced-transparency, las superficies son opacas.

## Navegación y pantallas

- Inicio es un lobby con estadio original, sprites oficiales separados y menú compacto. Jugar domina con sesión; Continuar partida aparece cuando corresponde. Sin sesión muestra Entrar y Crear cuenta. El fondo tiene variantes vertical/horizontal y respaldo CSS.
- Cinco destinos: Inicio, Jugar, Equipos, Partidas e Historial. Navbar flotante con iconos y etiquetas por debajo de 1024 px; navegación superior desde 1024 px. Marca y cuenta permanecen accesibles. Safe areas y espacio inferior reservan la navbar.
- Preparación mantiene formato y selección independiente de equipos OU, con pestañas para cada lado en móvil. Random Battle tiene explicación breve. El botón de inicio está fijado sobre la navbar en móvil/tablet; el contenido reserva espacio adicional. En desktop la acción usa un footer sticky.
- Equipos muestra sprites y legalidad. El editor tiene seis ranuras y, en móvil, un diálogo con secciones Pokémon, Set y Entrenamiento. Los campos permanecen montados y el borrador conserva los valores. Guardar/validar tienen prioridad; otras operaciones están agrupadas en opciones. El diálogo ofrece guardar y volver a las ranuras.
- Acceso, registro y recuperación usan el mismo sistema con fondo CSS, campos legibles y mensajes de validación. Los campos de texto usan 16 px para evitar zoom automático en móvil.
- Partidas e historial usan listas compactas con formato, sprites, turno, fecha y resultado; continuar/reproducir son enlaces reales.

## Combate y replay

Shell de altura 100dvh sin navbar inferior. Arena oscura con rival de frente, jugador de espalda, fondos locales de combate, HP/estado, clima/campo y efectos. Arena móvil entre 170 y 360 px, ajustada al viewport; controles tienen scroll interno. En landscape bajo, arena y controles se colocan lado a lado. Desktop añade registro lateral y limita la altura del panel de acciones.

Movimientos en cuadrícula 2×2 con nombre, tipo, categoría y PP. Un botón independiente abre detalles en Sheet, sin enviar elección; no requiere hover ni pulsación prolongada. Registro móvil abre otro Sheet. Cambio y Tera usan controles separados. Resultado presenta Pokémon, resultado y nueva partida/replay; replay ofrece play/pause, anterior/siguiente, velocidad y turno.

- La request vigente determina preview, movimiento, cambio o espera.
- Preview respeta slots reales y tamaño requerido; cambios forzados ocultan movimientos; Revival explica selección de debilitados.
- Tera refleja disponibilidad oficial. Envío/reproducción bloquean elecciones; fallo de respuesta reintenta la misma acción.
- Rendición pide confirmación y comunica el resultado persistido. Nunca se presentan datos ocultos del rival.

## Animación, accesibilidad y validación

El director reproduce eventos confirmados; la autoridad no depende de terminar animaciones. Se mantienen 1×/2× y omitir reproducción; ocultar pestaña detiene reproducción. prefers-reduced-motion reduce transiciones y usa sprites estáticos en arena/lobby. Sprites conservan índice local y fallbacks recuperables.

Navegación y controles compartidos tienen área táctil mínima de 48 px, nombre accesible, foco visible y disabled correcto. Modales/sheets contienen foco, lo restauran y permiten Escape. Selectores soportan teclado; iconos decorativos no repiten nombres. Información no depende solo del color.

Validar 320, 390 y 430 px, tablet, desktop, landscape, formularios con teclado móvil y viewports cortos. Revisar composición, interacción y acabado con capturas de lobby, setup, editor, combate, cambios/Revival, resultado y replay. Comprobar imágenes, consola, red y ausencia de overflow horizontal y controles solapados. E2E cubre foco, persistencia de campos entre secciones y consulta de detalles sin resolver turnos.
