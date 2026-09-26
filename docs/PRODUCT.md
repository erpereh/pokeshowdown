# Producto

Este documento define **qué es el producto, para quién existe, qué debe hacer y cuál es su alcance**.

Los detalles de implementación pertenecen a `ARCHITECTURE.md` y la dirección visual a `DESIGN.md`.

## Estado actual

El proyecto está en **Fase 0: definición y documentación**.

No existe todavía una versión jugable. Lo descrito como MVP representa el alcance aprobado para la primera implementación.

**Nombre de trabajo:** PokeShowdown. Es provisional y no debe tratarse como marca definitiva.

## Resumen

PokeShowdown será una aplicación web para construir equipos y disputar combates Pokémon competitivos en tiempo real.

La experiencia busca conservar la profundidad y fidelidad competitiva de Pokémon Showdown, pero con una interfaz propia, más moderna, visual, accesible y cómoda tanto en escritorio como en móvil.

## Propósito

El producto existe para ofrecer una experiencia de simulación competitiva que:

- permita entrar a jugar con poca fricción;
- facilite entender el estado de la batalla;
- haga más agradable construir y gestionar equipos;
- mantenga reglas y legalidad fiables;
- permita evolucionar la UI y las funciones sociales sin estar acoplados al cliente oficial de Pokémon Showdown.

## Principios de producto

### Fidelidad antes que espectacularidad

Una animación o decisión visual nunca puede ocultar información necesaria ni alterar la lógica del combate.

### El servidor decide

El cliente presenta opciones y envía decisiones. El resultado de turnos, daño, estados, velocidad, prioridad, RNG, victoria y validación se determina en servidor.

### Competitivo, pero accesible

Un jugador experimentado debe poder actuar rápido. Un jugador nuevo debe poder comprender tipos, estados, movimientos y decisiones sin necesitar conocer la implementación interna.

### Información progresiva

La pantalla debe mostrar primero lo necesario para decidir y permitir consultar detalles sin saturar la batalla.

## Usuarios

### Visitante

Puede:

- ver la página de entrada;
- consultar información pública;
- explorar una Pokédex o contenido público si existe en esa fase;
- registrarse o iniciar sesión.

No puede participar en matchmaking con progreso persistente.

### Jugador

Puede:

- gestionar su cuenta y perfil;
- crear, editar, duplicar, importar y exportar equipos;
- validar equipos para un formato;
- iniciar combates soportados;
- buscar rival;
- desafiar a otro jugador;
- jugar y reconectarse a una batalla activa;
- consultar su historial y replays;
- abandonar una batalla;
- reportar problemas o usuarios cuando exista moderación.

### Espectador

En las fases que lo soporten puede:

- observar combates públicos;
- consultar el log y estado visible del combate;
- no puede enviar decisiones por los jugadores.

### Administrador/moderador

Fuera del MVP inicial salvo las capacidades mínimas operativas.

En fases posteriores podrá:

- revisar reportes;
- aplicar acciones de moderación;
- consultar información operativa;
- gestionar contenido o incidencias sin alterar resultados históricos de combate.

## Áreas funcionales

### Autenticación

MVP:

- registro;
- inicio de sesión;
- cierre de sesión;
- recuperación de contraseña;
- sesión persistente.

Posterior:

- proveedores OAuth;
- 2FA si el riesgo/uso lo justifica.

### Perfil

MVP:

- nombre visible;
- avatar configurable dentro de las opciones permitidas;
- fecha de alta;
- estadísticas básicas;
- historial reciente.

Posterior:

- personalización ampliada;
- amigos;
- estado/presencia;
- logros cosméticos.

### Team Builder

MVP:

- crear y eliminar equipos;
- editar los seis slots;
- seleccionar especie y forma legal;
- nivel;
- género cuando aplique;
- objeto;
- habilidad;
- naturaleza;
- movimientos;
- EVs;
- IVs;
- variante shiny cuando sea visualmente soportada;
- formato asociado;
- validación;
- duplicación;
- importación/exportación en formato de texto compatible;
- mensajes de error de legalidad comprensibles.

Reglas:

- el Team Builder puede permitir editar temporalmente un equipo inválido;
- un equipo inválido no puede entrar en un formato que exija validación;
- la validación final debe provenir del validador del motor, no de reglas duplicadas en el frontend.

### Formatos

MVP:

- Gen 9 OU;
- Gen 9 Random Battle.

La arquitectura debe permitir añadir nuevos formatos sin modificar la UI base del combate.

Los formatos disponibles en producto se configuran explícitamente. Que el motor soporte un formato no implica que el producto lo publique automáticamente.

### Combate

MVP:

- 1v1 singles;
- selección de movimientos;
- selección de cambio;
- turnos;
- estados;
- clima/campo cuando aplique;
- información de HP permitida por el formato;
- log de batalla;
- temporizador básico si se habilita para el formato;
- rendición;
- reconexión;
- final de batalla;
- replay.

La interfaz nunca debe revelar información que el jugador no debería conocer según el estado del combate.

### Matchmaking

MVP:

- entrar en cola por formato;
- cancelar búsqueda;
- emparejar solo jugadores compatibles;
- evitar crear dos partidas simultáneas por la misma entrada de cola;
- transición directa de match encontrado a sala de batalla.

La primera versión de matchmaking puede ser casual. El rating competitivo persistente puede activarse cuando el loop principal sea estable.

### Desafíos privados

MVP:

- desafiar a un usuario o mediante enlace/código;
- seleccionar formato;
- aceptar o rechazar;
- impedir que un desafío caducado inicie una batalla.

### Historial y replays

MVP:

- registrar participantes;
- formato;
- fecha;
- resultado;
- identificador de batalla;
- replay reproducible a partir del log/eventos persistidos.

Un replay es de solo lectura. No debe poder modificar el resultado histórico.

## Flujo principal

### Primera partida

1. El usuario entra en la aplicación.
2. Se registra o inicia sesión.
3. Elige un formato.
4. Para OU selecciona un equipo válido; para Random Battle no necesita equipo.
5. Entra en matchmaking o crea un desafío.
6. Se crea la batalla.
7. Ambos clientes reciben el estado permitido.
8. Cada jugador envía sus decisiones.
9. El servidor resuelve y emite los eventos.
10. Al terminar se persiste el resultado y el replay.
11. El usuario puede volver a jugar o consultar el combate.

### Creación de equipo

1. El usuario abre Team Builder.
2. Crea un equipo y selecciona formato.
3. Configura cada Pokémon.
4. La UI ayuda con opciones compatibles, pero no sustituye la validación oficial.
5. El servidor valida.
6. Se muestran errores accionables o el estado válido.
7. El usuario guarda el equipo.

## Reglas de negocio

- Un usuario solo puede modificar sus propios equipos y datos editables.
- Las decisiones de batalla se aceptan únicamente para el jugador, batalla y turno correspondientes.
- Una decisión duplicada o atrasada no debe ejecutarse dos veces.
- El servidor es la única autoridad sobre el estado real de la batalla.
- El frontend no calcula daño ni legalidad como fuente de verdad.
- No se inicia matchmaking competitivo con un equipo inválido.
- Random Battle genera el equipo en servidor.
- No se expone al rival información privada del equipo antes de que las reglas permitan conocerla.
- El resultado persistido debe coincidir con el resultado emitido por el motor.
- Una desconexión no equivale automáticamente a derrota; debe existir una ventana de reconexión/timeout definida.
- Una batalla finalizada es inmutable salvo metadatos administrativos claramente separados.
- Los cambios de versión del motor no deben reinterpretar replays históricos silenciosamente.
- Los formatos disponibles se versionan/configuran de forma controlada.

## Criterios de éxito del MVP

El MVP se considera funcional cuando:

- dos usuarios pueden iniciar una batalla real desde navegadores separados;
- ambos reciben únicamente la información que les corresponde;
- pueden completar un combate Gen 9 OU y uno Random Battle;
- el servidor recupera correctamente errores, decisiones inválidas y desconexiones comunes;
- un equipo OU se puede crear, importar, exportar y validar;
- el resultado y replay sobreviven a un reinicio del frontend;
- la experiencia principal es usable en escritorio y móvil;
- existen pruebas automáticas para los flujos críticos.

## Alcance actual aprobado

### Incluido en el MVP

- web responsive;
- cuentas;
- perfil básico;
- Team Builder;
- Gen 9 OU;
- Gen 9 Random Battle;
- singles 1v1;
- matchmaking;
- desafíos;
- reconexión;
- historial;
- replays;
- modo claro y oscuro;
- base de accesibilidad;
- pruebas unitarias, integración y E2E para rutas críticas.

### Fuera del MVP

- aplicación móvil nativa;
- modelos 3D;
- recrear animaciones exactas de los juegos;
- chat global;
- clanes;
- torneos;
- marketplace;
- pagos;
- campañas/PvE;
- IA de combate avanzada;
- soporte completo de todas las generaciones el día 1;
- doubles/VGC el día 1;
- sistema de moderación complejo;
- compatibilidad con el login oficial de Pokémon Showdown;
- copiar o reutilizar código del cliente oficial de Pokémon Showdown.

## Futuro

Candidatos, no compromisos:

- más generaciones y tiers;
- doubles/VGC;
- ladder y temporadas;
- rankings;
- espectadores;
- torneos;
- amigos y presencia;
- estadísticas avanzadas;
- análisis post-partida;
- Pokédex integrada;
- sets sugeridos;
- internacionalización;
- PWA;
- personalización cosmética;
- formatos custom.

Toda función de esta sección requiere ser movida explícitamente al alcance antes de implementarse.
