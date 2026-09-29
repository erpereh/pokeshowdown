# Producto y reglas

PokeShowdown ofrece combates singles PvE contra CPU con Gen 9 OU y Gen 9 Random Battle. Este MVP excluye Private Battle y cualquier multijugador.

## Funcionalidades

| Área | Comportamiento |
| --- | --- |
| Cuenta | Registro, confirmación, acceso, cierre y recuperación/cambio de contraseña con Supabase Auth. |
| Equipos | Crear, editar, duplicar, eliminar, importar/exportar Showdown y validar. Hasta seis slots: especie/forma, nivel, género, objeto, habilidad, naturaleza, movimientos, EVs, IVs, shiny y tipo Tera. |
| Gen 9 OU | Cada lado elige independientemente equipo personalizado o aleatorio. El personalizado es un equipo propio guardado o una importación. |
| Gen 9 Random Battle | Equipos y niveles del generador oficial de la versión instalada; sin Team Preview ni personalizados. |
| Combate | Movimientos, cambios voluntarios/forzados, Teracristalización, Revival Blessing, estados, clima/campo, rendición, registro, resultado y replay. |
| Persistencia | Equipos, partidas activas, historial y replays vinculados al usuario; autosave en servidor. |

Un borrador inválido puede guardarse. Antes de iniciar OU se valida otra vez mediante TeamValidator. Se respetan equipos legales de uno a seis Pokémon. Un equipo aleatorio OU se genera y valida para OU: no convierte el formato en Random Battle. La previsualización permite revisar exactamente los sets elegidos; regenerar crea otra propuesta.

## Navegación e interacción

El inicio es un lobby: Jugar abre la preparación de partida; Continuar partida aparece si hay un combate activo. Sin sesión ofrece acceso y registro. La navegación enlaza Inicio, Jugar, Equipos, Partidas e Historial; combate y replay tienen controles propios.

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

## Invariantes

- Showdown decide reglas, daño, RNG, legalidad, victoria y requests.
- El navegador no calcula resultados ni recibe seeds, equipos ocultos o input logs.
- Cada acción pertenece al usuario, partida y revisión vigentes.
- CPU recibe solo su request y la información pública.
- Toda confirmación es durable; una partida finalizada no cambia de resultado.
- Equipos e historial solo son accesibles por su dueño.
- Replay guarda versión y frames públicos, sin resimular versiones antiguas.

## Criterios de aceptación

Completar las cuatro combinaciones OU personalizado/aleatorio y Gen 9 Random Battle. Resolver cambios forzados, Tera y Revival con motor real; reanudar sin duplicar turnos; gestionar equipos y reproducir resultados. Pasar typecheck, unit/integración real, verify:engine, build y E2E desktop/móvil; revisar tres ciclos visuales, recursos, animaciones, consola y red.

Fuera de alcance: multijugador, salas, matchmaking/ranked, espectadores, torneos, chat, campañas, doubles/VGC, otras generaciones, pagos y aplicaciones nativas.
