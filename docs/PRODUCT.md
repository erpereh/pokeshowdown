# Producto y reglas

**Estado:** alcance aprobado; sin implementación jugable. Nombre de trabajo: PokeShowdown. Las decisiones visuales se definirán más adelante.

## Funcionalidades iniciales

| Área | Comportamiento |
| --- | --- |
| Cuenta | Registro, acceso, cierre de sesión y recuperación con Supabase Auth; perfil básico e historial. |
| Equipos | Crear, editar, duplicar, eliminar, importar/exportar en formato Showdown y validar. Seis slots con especie/forma, nivel, género si aplica, objeto, habilidad, naturaleza, movimientos, EVs, IVs y shiny. |
| Formatos | Gen 9 OU (equipo propio validado) y Gen 9 Random Battle (equipos generados por Showdown). |
| Combate | Singles 1v1, movimientos/cambios, estados, campo/clima, rendición, log, resultado y replay. |
| Single Player | Oponente CPU, inicio inmediato, autosave y continuación de partida. |
| Private Battle | Sala para exactamente dos personas, creada por uno e incorporada por invitación/código; ambos preparados antes del inicio. |
| Persistencia | Equipos, partidas activas, historial y replays vinculados al usuario. |

Un equipo puede guardarse mientras se edita aunque sea inválido; no puede iniciar un formato que requiera equipo válido sin pasar `TeamValidator`.

## Single Player

1. El usuario elige formato/equipo; el sistema crea la partida persistida con datos suficientes para reconstruirla.
2. Elige una acción; Vercel valida, reconstruye el motor y calcula la elección legal de CPU.
3. Showdown resuelve y se **guarda el turno antes de devolver confirmación**.
4. Tras cerrar la pestaña, reabrir o cambiar de dispositivo, se ofrece continuar desde el último turno confirmado.

Una petición duplicada, retrasada o fallida no debe consumir dos veces el turno. Si se cierra durante el procesamiento, al reanudar se recupera el último estado confirmado. La estrategia CPU debe poder evolucionar sin alterar el motor.

## Private Battle

1. Se crea sala privada con formato, caducidad y código/enlace no predecible.
2. Entra el segundo usuario; se verifican identidad, plaza, equipos y disponibilidad.
3. Cada jugador envía su decisión en privado. El rival no conoce la elección pendiente.
4. Con ambas decisiones, una única ejecución reclama y resuelve el turno mediante Showdown; se persiste el resultado antes de avisar por Realtime.
5. Los participantes recuperan sus vistas autorizadas; una caída de navegador permite reanudar la batalla desde datos persistidos.

Ningún navegador actúa como host ni decide daño, RNG, legalidad o victoria.

## Invariantes

- Cada acción pertenece al usuario, batalla, turno y request vigentes. No aceptar elecciones inválidas/duplicadas.
- No filtrar equipo completo, movimientos no revelados o elecciones pendientes al otro jugador.
- Cada turno confirmado de ambos modos es durable y su resultado coincide con el motor.
- La CPU usa una solicitud de decisión apropiada, sin información oculta accidental.
- La batalla finalizada no altera su resultado; el replay es de solo lectura y registra versión del motor.
- «Random Battle» no implica adversario aleatorio.

## Criterios de aceptación

- Un usuario completa OU y Random Battle contra CPU; al cerrar/reabrir a mitad de partida conserva el último turno.
- Dos cuentas completan una batalla privada desde navegadores distintos; invitación, validación y reanudación funcionan.
- No hay doble resolución bajo envíos simultáneos o retries ni filtraciones entre participantes.
- Equipos, historial y replays persisten.
- Tests unitarios, integración y E2E cubren estos flujos críticos.

**No entra ahora:** emparejamiento público/ranked, espectadores, torneos, chat, campañas, doubles/VGC, todas las generaciones, pagos, aplicaciones nativas ni decisiones de interfaz visual.
