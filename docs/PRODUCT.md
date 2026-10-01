# Producto y reglas

PokeShowdown ofrece combates singles contra la CPU y combates online entre amigos, en Gen 9 OU y Gen 9 Random Battle. No hay salas públicas ni emparejamiento: el juego online solo existe mediante desafíos entre amigos.

## Funcionalidades

| Área | Comportamiento |
| --- | --- |
| Cuenta | Registro, confirmación, acceso, cierre y recuperación/cambio de contraseña con Supabase Auth. |
| Equipos | Crear, editar, duplicar, eliminar, importar/exportar Showdown y validar. Hasta seis slots: especie/forma, nivel, género, objeto, habilidad, naturaleza, movimientos, EVs, IVs, shiny y tipo Tera. |
| Gen 9 OU | Cada lado elige independientemente equipo personalizado o aleatorio. El personalizado es un equipo propio guardado o una importación. |
| Gen 9 Random Battle | Equipos y niveles del generador oficial de la versión instalada; sin Team Preview ni personalizados. |
| Combate | Movimientos, cambios voluntarios/forzados, Teracristalización, Revival Blessing, estados, clima/campo, rendición, registro, resultado y replay. |
| Amigos | Código de amigo único y permanente (8 caracteres, se muestra como `ABCD-2345`), visible y copiable desde el menú de cuenta y la pestaña Amigos. Añadir por código, solicitudes recibidas (aceptar/rechazar) y enviadas (cancelar), lista con presencia en línea/desconectado, eliminar amigo e invitar a combatir. Dos solicitudes cruzadas se aceptan solas. |
| Desafíos online | Quien invita fija formato, temporizador (sin límite, 60 s o 120 s por decisión), origen del equipo OU (solo guardados, o guardado o aleatorio legal) y caducidad (2/5/10 min, 5 por defecto). El invitado ve todos los detalles en tiempo real y solo puede aceptar o rechazar; nadie puede cambiar las reglas después. |
| Persistencia | Equipos, partidas activas, historial y replays vinculados al usuario; autosave en servidor. Cada jugador de un combate online tiene su propia partida, historial y replay desde su perspectiva. |

Un borrador inválido puede guardarse. Antes de iniciar OU se valida otra vez mediante TeamValidator. Se respetan equipos legales de uno a seis Pokémon. Un equipo aleatorio OU se genera y valida para OU: no convierte el formato en Random Battle. La previsualización permite revisar exactamente los sets elegidos; regenerar crea otra propuesta.

## Navegación e interacción

Con sesión, la pantalla principal es Jugar (`/` redirige a `/play`): presentación, Continuar partida si hay un combate activo y la preparación de partida. Sin sesión, `/` ofrece acceso y registro. La navegación enlaza Amigos, Equipos, Jugar, Partidas e Historial; Amigos muestra una insignia con solicitudes y desafíos pendientes. Las invitaciones y solicitudes se notifican dentro de la aplicación en cualquier sección, también durante un combate. Combate y replay tienen controles propios.

En móvil OU configura cada lado por separado mediante pestañas. El editor agrupa campos en Pokémon, Set y Entrenamiento sin perder cambios al cambiar de sección; guardar sigue siendo explícito. Importar, exportar y generar están en opciones de equipo.

Los detalles de movimientos se consultan desde un botón independiente, sin seleccionar el movimiento ni resolver un turno. El registro móvil se abre en un panel. Estas acciones solo muestran la información pública ya disponible.

## Ciclo de combate

1. Elegir formato/equipos y persistir la partida antes de devolverla.
2. Recibir la request vigente del motor y elegir una acción legal.
3. Reconstruir Showdown en servidor, obtener elección CPU y resolver.
4. Guardar secretos, checkpoint, frame y revisión atómicamente antes de confirmar.
5. Reanudar desde el último estado confirmado tras cerrar/reabrir o acceder desde otro navegador.
6. Conservar resultado e historial; reproducir el replay de solo lectura.

Una solicitud repetida no consume dos veces la decisión. Si se pierde una respuesta, se conserva la acción y se reintenta con el mismo ID. Una revisión obsoleta recupera la vista confirmada. No se sustituye una acción de resultado incierto por otra elección.

Revival Blessing pide un debilitado del propio equipo; los sanos no son seleccionables. Revivir al banquillo no sustituye al activo. Teracristalización se ofrece únicamente cuando Showdown la permite.

## Amigos y desafíos online

1. Un desafío solo puede enviarse a un amigo. Entre dos jugadores hay como máximo un desafío abierto (pendiente o en preparación): si ambos se desafían a la vez, prevalece uno y el otro recibe el existente.
2. La invitación caduca a los minutos elegidos; el invitado puede aceptar o rechazar y quien invita puede cancelarla. Eliminar a un amigo cancela los desafíos abiertos entre ambos.
3. Tras aceptar, ambos jugadores eligen equipo según las reglas (OU: equipo guardado válido o, si se permite, uno aleatorio legal generado en servidor; Random Battle: equipos oficiales) y pulsan «Listo». Se puede volver a «No listo» antes de empezar. La preparación caduca a los 10 minutos.
4. Cuando ambos están listos el combate empieza automáticamente con Showdown, incluido Team Preview oficial en OU. Cada jugador elige en secreto; el turno se resuelve cuando ambos han elegido.
5. Temporizador: con límite, cada decisión pendiente tiene un plazo autoritativo en servidor. Si vence, pierde quien no eligió (empate si vencen ambos). Desconectarse no lo pausa; al volver se reanuda el mismo estado y plazo desde Partidas, Amigos o el enlace del combate.
6. Rendirse da la victoria al rival. Resultado, historial y replay quedan guardados para ambos.

El rival nunca ve el equipo ni las elecciones del otro antes de que Showdown las revele; solo sabe si ya ha elegido y si está conectado.

## Invariantes

- Showdown decide reglas, daño, RNG, legalidad, victoria y requests.
- El navegador no calcula resultados ni recibe seeds, equipos ocultos o input logs.
- Cada acción pertenece al usuario, partida y revisión vigentes.
- CPU recibe solo su request y la información pública; en online, cada jugador recibe solo la perspectiva de su lado.
- Las reglas de un desafío son inmutables tras crearlo.
- Toda confirmación es durable; una partida finalizada no cambia de resultado.
- Equipos, partidas e historial solo son accesibles por su dueño; de otros jugadores solo se comparten nombre visible y código de amigo, nunca el correo.
- Replay guarda versión y frames públicos, sin resimular versiones antiguas.

## Criterios de aceptación

Completar las cuatro combinaciones OU personalizado/aleatorio y Gen 9 Random Battle. Resolver cambios forzados, Tera y Revival con motor real; reanudar sin duplicar turnos; gestionar equipos y reproducir resultados. Pasar typecheck, unit/integración real, verify:engine, build y E2E desktop/móvil; revisar tres ciclos visuales, recursos, animaciones, consola y red.

Online: dos cuentas reales agregan amistad, envían y aceptan un desafío, preparan equipos, juegan un combate completo y guardan resultado e historial; se prueban errores, RLS, desafíos simultáneos, caducidad, desconexión/reconexión y derrota por tiempo.

Fuera de alcance: salas públicas, matchmaking/ranked, espectadores, torneos, chat, campañas, doubles/VGC, otras generaciones, pagos y aplicaciones nativas.
