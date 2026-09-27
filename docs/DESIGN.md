# Diseño

La interfaz usa una arena competitiva oscura. Se conservan el diseño y los componentes existentes.

## Sistema visual y navegación

Inter para texto/formularios y Chakra Petch para títulos, navegación y acciones, mediante next/font. Tokens compartidos en globals.css para fondos, superficies glass/fallback opaco, bordes, texto, acentos amarillo/cian y estados. Tipos Pokémon combinan colores e iconos oficiales con texto.

GameButton, GlassPanel, Modal/Sheet, chips, barras de HP y estados loading/empty/error son los patrones compartidos. Radios, duraciones y easing usan variables comunes.

Navegación superior en desktop y pestañas inferiores con safe-area en móvil. Combate/replay reservan altura mediante un shell sin pestañas inferiores.

## Pantallas e interacción

Setup conserva formato y selección independiente de equipos. Team Builder usa un rail de seis slots, editor y preview; el editor móvil es un panel modal con scroll.

Arena: rival de frente, jugador de espalda, fondo local, HUD de HP/estado, overlays de clima/campo y efectos. Registro lateral en desktop y Sheet en móvil. Acciones debajo, con scroll interno en viewports cortos.

Partidas e historial usan listas con estados vacíos y enlaces reales. Resultado ofrece nueva partida/replay. Replay tiene play/pause, anterior/siguiente, velocidad y selección de turno.

- La request vigente determina preview, movimiento, cambio o espera.
- Preview respeta los slots reales y tamaño requerido.
- Cambios forzados ocultan movimientos; Revival explica la selección de debilitados.
- Tera refleja disponibilidad oficial.
- Envío/reproducción bloquean elecciones; fallo de respuesta ofrece retry de la misma acción.
- Rendición pide confirmación y comunica el resultado persistido.

## Animación y recursos

El director reproduce eventos confirmados: movimientos, impactos, cambios, debilitamiento, curación, estados y Tera. La lógica autoritativa no depende de terminar animaciones.

Velocidad 1×/2× y omitir reproducción. prefers-reduced-motion minimiza transiciones y usa sprites estáticos. Ocultar pestaña detiene reproducción y conserva el estado confirmado.

Sprites usan índice runtime local, variantes y fallback estático. Placeholder únicamente cuando no hay recurso. Fallos transitorios del índice se pueden recuperar al volver conexión/visibilidad.

## Accesibilidad y responsive

Controles con nombre, foco visible, disabled correcto y área táctil mínima 44px. Modales/sheets contienen foco y lo restauran; Escape cuando corresponde. Selectores respetan su semántica y navegación por teclado.

Mantener arena, HP, acciones y cambios legibles en desktop, tablet y móvil, sin overflow horizontal ni acciones permanentemente ocultas. Revisar capturas de setup, equipos, combate, cambios/revival, resultado y replay en ambos tamaños.
