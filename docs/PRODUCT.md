# Producto

Este documento define qué es el producto, qué modos incluye y cómo debe comportarse desde el punto de vista del jugador.

## Estado

El proyecto todavía no tiene una versión jugable implementada.

**Nombre de trabajo:** PokeShowdown.

## Resumen

PokeShowdown será una aplicación web para construir equipos y disputar combates Pokémon con dos modos:

1. **Single Player** contra CPU.
2. **Private Battle** 1v1 entre dos amigos mediante código o enlace.

La simulación y legalidad se basan en Pokémon Showdown.

## Principios

### Fidelidad

Pokémon Showdown es la referencia para mecánicas, RNG, legalidad y formatos.

### Persistencia

Una partida activa no debe depender de mantener una pestaña abierta.

Single Player se guarda después de cada turno resuelto.

Private Battle persiste cada decisión necesaria y cada turno resuelto.

### Información privada

Cada jugador recibe únicamente la información que puede conocer.

Las elecciones pendientes de un jugador nunca se muestran al rival antes de resolver el turno.

### Reanudación

Cerrar el navegador no debe destruir una partida activa.

El sistema debe reconstruirla desde los datos persistidos y continuar desde el último estado confirmado.

## Usuarios

### Visitante

Puede:

- ver la entrada;
- consultar contenido público si existe;
- registrarse;
- iniciar sesión.

### Jugador

Puede:

- gestionar su perfil;
- crear y guardar equipos;
- importar/exportar equipos;
- validar equipos;
- iniciar Single Player;
- crear Private Battle;
- entrar en una Private Battle mediante invitación;
- reanudar partidas activas;
- consultar historial;
- abrir replays.

## Autenticación

Supabase Auth gestiona:

- registro;
- login;
- logout;
- recuperación de contraseña;
- sesión persistente.

## Perfil

MVP:

- nombre visible;
- avatar;
- fecha de alta;
- estadísticas básicas;
- historial reciente.

## Team Builder

MVP:

- crear, editar, duplicar y eliminar equipos;
- seis slots;
- especie/forma;
- nivel;
- género cuando aplique;
- objeto;
- habilidad;
- naturaleza;
- movimientos;
- EVs;
- IVs;
- shiny cuando aplique;
- formato;
- validación;
- import/export compatible con Showdown.

La UI puede permitir edición temporalmente inválida, pero una battle que requiera equipo solo puede empezar con un equipo válido.

La validación final proviene de Pokémon Showdown.

## Formatos iniciales

- Gen 9 OU.
- Gen 9 Random Battle.

"Random Battle" describe la generación aleatoria de equipos del formato.

## Combate

MVP:

- singles 1v1;
- movimientos;
- cambios;
- turnos;
- estados;
- clima/campo;
- HP visible según corresponda;
- boosts;
- log;
- rendición;
- reanudación;
- final de battle;
- replay.

## Single Player

### Flujo

1. el jugador elige formato;
2. para OU selecciona un equipo válido;
3. para Random Battle el sistema genera los equipos mediante Showdown;
4. el jugador envía una elección;
5. el backend serverless valida la petición;
6. la CPU genera una elección legal;
7. Pokémon Showdown resuelve el turno;
8. el turno y los datos necesarios para reconstruir la battle se guardan en Supabase;
9. solo después del guardado el turno se considera confirmado para el cliente.

### Autosave

El guardado ocurre después de **cada turno resuelto**.

Debe permitir:

- cerrar la pestaña;
- cerrar el navegador;
- iniciar sesión desde otro dispositivo;
- recuperar la partida;
- continuar desde el último turno confirmado.

Si una petición se repite por timeout/retry, no debe resolver el mismo turno dos veces.

### CPU

La CPU genera decisiones válidas a partir del request de battle.

La estrategia debe ser sustituible para poder mejorarla en el futuro sin cambiar el motor.

## Private Battle

### Sala

El host:

1. crea una sala;
2. selecciona formato;
3. recibe un código/enlace de invitación.

El invitado:

1. abre el enlace o introduce el código;
2. entra en la sala;
3. selecciona/valida equipo cuando corresponda;
4. confirma que está preparado.

Solo los dos participantes pueden acceder a datos privados de la battle.

### Turno

1. cada jugador envía su elección al backend;
2. la elección se valida y se guarda de forma privada;
3. la elección pendiente no se revela al rival;
4. al existir ambas elecciones, una única ejecución reclama la resolución del turno;
5. se reconstruye/carga Pokémon Showdown;
6. se aplican ambas decisiones;
7. se resuelve el turno;
8. el nuevo estado se persiste;
9. Supabase Realtime Broadcast avisa a ambos clientes;
10. cada cliente recibe/consulta su vista permitida.

### Concurrencia

Dos peticiones simultáneas no pueden:

- resolver dos veces el mismo turno;
- crear dos resultados distintos;
- sobrescribir una elección confirmada de forma accidental.

Las operaciones críticas deben ser idempotentes y atómicas.

## Guardado y reanudación

Una battle activa conserva suficiente información canónica para ser reconstruida.

Conceptualmente:

- battle id;
- mode;
- format id;
- engine version;
- seed;
- snapshots/equipos necesarios;
- input log;
- turno actual;
- status;
- timestamps.

La UI no es fuente de verdad.

## Historial y replays

Guardar:

- participantes;
- modo;
- formato;
- fecha;
- resultado;
- battle id;
- engine version;
- replay/input log necesario.

Los replays son de solo lectura.

## Reglas de negocio

- un usuario solo modifica sus datos permitidos;
- una elección pertenece a un usuario, battle y request concretos;
- una petición obsoleta/repetida no se ejecuta dos veces;
- el backend resuelve las battles mediante Pokémon Showdown;
- el frontend no calcula daño como autoridad;
- no se inicia OU con equipo inválido;
- Random Battle se genera con Showdown;
- no se filtra información oculta;
- el estado persistido debe coincidir con el resultado del motor;
- cada turno Single Player se persiste;
- cada turno Private Battle se persiste antes de notificarse;
- las battles finalizadas no cambian su resultado;
- engine version queda asociada a battle/replay.

## Criterios de éxito del MVP

- registro/login funcional;
- Team Builder funcional;
- validación OU correcta;
- Single Player completo;
- autosave de Single Player por turno;
- cierre/reapertura y reanudación correcta;
- Private Battle mediante código/enlace;
- dos navegadores completan una battle;
- ninguna elección privada se filtra;
- reconexión/reanudación funciona;
- Gen 9 OU funciona;
- Gen 9 Random Battle funciona;
- resultado e historial persisten;
- replay se puede consultar;
- experiencia usable en móvil y escritorio;
- pruebas automáticas cubren flujos críticos.

## Alcance inicial

- web responsive;
- Supabase Auth;
- perfiles;
- Team Builder;
- OU;
- Random Battle;
- Single Player;
- CPU;
- autosave;
- Private Battle 1v1;
- invitaciones;
- Supabase Realtime;
- historial;
- replays;
- dark/light;
- tests unitarios, integración y E2E.

## Fuera del alcance inicial

- aplicación nativa;
- 3D;
- chat global;
- clanes;
- torneos;
- marketplace;
- pagos;
- campañas;
- PvE narrativo;
- soporte completo de todas las generaciones;
- doubles/VGC;
- espectadores;
- moderación compleja;
- login oficial de Pokémon Showdown.
