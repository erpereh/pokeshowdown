# Producto

Este documento define **qué es el producto, para quién existe, qué debe hacer y cuál es su alcance**.

Los detalles de implementación pertenecen a `ARCHITECTURE.md` y la dirección visual a `DESIGN.md`.

## Estado actual

El proyecto está en **Fase 0: definición y documentación**.

No existe todavía una versión jugable. Lo descrito como MVP representa el alcance aprobado para la primera implementación.

**Nombre de trabajo:** PokeShowdown. Es provisional y no debe tratarse como marca definitiva.

## Resumen

PokeShowdown será una aplicación web para construir equipos y disputar combates Pokémon en dos modos: partidas individuales contra CPU y partidas privadas entre dos amigos.

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

No puede guardar progreso persistente ni participar en partidas privadas que requieran cuenta.

### Jugador

Puede:

- gestionar su cuenta y perfil;
- crear, editar, duplicar, importar y exportar equipos;
- validar equipos para un formato;
- iniciar combates soportados;
- iniciar partidas individuales contra CPU;
- crear una sala privada;
- unirse a la sala privada de un amigo mediante código o enlace;
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

### Single Player

MVP:

- iniciar una battle contra CPU;
- elegir formato;
- usar un equipo propio cuando el formato lo requiera;
- usar Random Battle sin equipo previo;
- resolver las decisiones de la CPU en el game server;
- guardar resultado y replay igual que una battle multijugador.

La CPU no debe tener acceso a información oculta que un jugador normal no conocería, salvo que una futura dificultad se diseñe explícitamente de otra forma.

### Partida privada entre dos amigos

MVP:

- crear una sala privada;
- generar un identificador/código no predecible;
- generar un enlace de invitación;
- un segundo jugador puede unirse a la sala;
- seleccionar formato;
- validar el equipo de ambos cuando corresponda;
- iniciar la battle solo cuando ambos participantes estén preparados;
- reconectar a la misma battle si uno pierde la conexión;
- impedir el acceso de terceros a una sala privada.

No existe matchmaking público, cola global ni emparejamiento con jugadores desconocidos.

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

### Partida individual

1. El usuario entra en la aplicación.
2. Se registra o inicia sesión.
3. Elige Single Player y un formato.
4. Para OU selecciona un equipo válido; para Random Battle no necesita equipo.
5. El game server crea la battle y el oponente CPU.
6. El jugador envía sus decisiones.
7. La CPU genera una decisión legal.
8. Pokémon Showdown resuelve el turno.
9. Al terminar se persiste el resultado y el replay.

### Partida privada con un amigo

1. El usuario crea una sala privada.
2. Selecciona el formato y, cuando aplique, un equipo válido.
3. La aplicación genera un código/enlace de invitación.
4. El segundo jugador abre el enlace o introduce el código.
5. Ambos jugadores confirman que están preparados.
6. El game server crea la battle.
7. Cada jugador recibe únicamente la información que le corresponde.
8. Ambos envían sus decisiones por WebSocket.
9. Pokémon Showdown resuelve cada turno.
10. Al terminar se persiste el resultado y el replay.

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
- No se inicia una battle que requiera equipo mientras el equipo sea inválido.
- Random Battle genera el equipo en servidor.
- No se expone al rival información privada del equipo antes de que las reglas permitan conocerla.
- El resultado persistido debe coincidir con el resultado emitido por el motor.
- Una desconexión no equivale automáticamente a derrota; debe existir una ventana de reconexión/timeout definida.
- Una batalla finalizada es inmutable salvo metadatos administrativos claramente separados.
- Los cambios de versión del motor no deben reinterpretar replays históricos silenciosamente.
- Los formatos disponibles se versionan/configuran de forma controlada.

## Criterios de éxito del MVP

El MVP se considera funcional cuando:

- un usuario puede completar una battle Single Player contra CPU;
- dos usuarios pueden iniciar una battle privada desde navegadores separados usando código/enlace;
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
- Single Player contra CPU;
- salas privadas 1v1;
- invitaciones por código/enlace;
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
- matchmaking público con desconocidos;
- ladder/ranked público;
- sistema de moderación complejo;
- compatibilidad con el login oficial de Pokémon Showdown;
- copiar o reutilizar código del cliente oficial de Pokémon Showdown.

## Futuro

Candidatos, no compromisos:

- más generaciones y tiers;
- doubles/VGC;
- matchmaking público, solo si se decide explícitamente en el futuro;
- ladder y temporadas, solo si se decide explícitamente en el futuro;
- rankings públicos;
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
