# AGENTS.md

## Objetivo

Este archivo define como debe trabajar la IA dentro de este proyecto.

## Flujo de trabajo

Antes de modificar codigo:

1. Entender exactamente el cambio solicitado.
2. Revisar el codigo existente relacionado con la tarea.
3. Identificar que documentacion es relevante.
4. Leer solo la documentacion necesaria.
5. Modificar unicamente lo necesario.
6. Validar el resultado antes de finalizar.

## Carga de contexto

No leer toda la documentacion por defecto.

- Leer `docs/PRODUCT.md` cuando la tarea afecte a funcionalidad, comportamiento, reglas de negocio, usuarios o alcance del producto.
- Leer `docs/ARCHITECTURE.md` cuando la tarea afecte a arquitectura, flujo de datos, dependencias, backend, base de datos o estructura del proyecto.
- Leer `docs/DESIGN.md` cuando la tarea afecte a UI, UX, estilos, responsive, componentes visuales o animaciones.
- Leer `docs/DATA-SOURCES.md` cuando la tarea afecte a datos de Pokemon, reglas/formats, sincronizacion, IDs o integraciones de datos externas.
- Leer `docs/ASSET-INVENTORY.md` cuando la tarea afecte a sprites, artwork, iconos, fondos, audio, manifest o pipelines de assets.
- Leer `docs/ROADMAP.md` solo cuando la tarea trate sobre priorizacion, fases o siguiente trabajo. El roadmap no demuestra que algo este implementado.
- Para cambios pequenos y aislados, revisar directamente el codigo relacionado.
- Leer varios documentos solo cuando la tarea realmente afecte a varias areas.

## Reglas generales

- Reutilizar codigo existente antes de crear nuevas abstracciones.
- Seguir los patrones ya existentes en el proyecto.
- No modificar funcionalidad no relacionada con la tarea.
- No introducir nuevas dependencias salvo que sean necesarias.
- No duplicar logica existente.
- Mantener los cambios pequenos, claros y enfocados.
- Evitar sobreingenieria.
- Preferir soluciones simples, mantenibles y coherentes con el proyecto.
- No inventar arquitectura, componentes o patrones si ya existe una solucion equivalente.
- No implementar funcionalidades fuera del alcance definido en `docs/PRODUCT.md` salvo que se solicite explicitamente.

## Reglas especificas del dominio

- El servidor es autoritativo para una battle.
- No reimplementar mecanicas Pokemon en frontend o backend si el motor de Pokemon Showdown ya es la fuente de verdad.
- La validacion final de equipos debe delegarse al motor/adaptador.
- No acoplar componentes UI directamente al protocolo interno de Pokemon Showdown.
- No copiar codigo del cliente oficial de Pokemon Showdown sin una decision explicita y revision de licencia.
- No incorporar assets externos sin registrar procedencia y estado en `docs/ASSET-INVENTORY.md`.
- Que un repositorio sea open source no significa que sus imagenes, marcas, sonidos o personajes sean reutilizables.
- No revelar al cliente informacion oculta del rival.

## Fuentes de verdad

Cada documento tiene una responsabilidad concreta:

- `docs/PRODUCT.md`: que es el producto, que debe hacer y que funcionalidades tiene.
- `docs/ARCHITECTURE.md`: como esta construido tecnicamente y, mientras no exista implementacion, la arquitectura objetivo aprobada.
- `docs/DESIGN.md`: como debe verse y comportarse visualmente.
- `docs/DATA-SOURCES.md`: de donde procede cada clase de dato y que fuente gana ante conflicto.
- `docs/ASSET-INVENTORY.md`: assets requeridos, fuentes, cobertura y estado de derechos.
- `docs/ROADMAP.md`: orden previsto; nunca debe usarse como prueba de estado implementado.
- El codigo representa la implementacion real actual.

Evitar duplicar la misma informacion en varios documentos.

Si el codigo y la documentacion se contradicen, analizar la discrepancia antes de asumir una solucion y actualizar la documentacion cuando corresponda.

## Mantenimiento de documentacion

- Si cambia una funcionalidad, regla de negocio o alcance, actualizar `docs/PRODUCT.md`.
- Si cambia la arquitectura, actualizar `docs/ARCHITECTURE.md`.
- Si cambian las reglas visuales o de UX, actualizar `docs/DESIGN.md`.
- Si cambia una fuente, mapeo o prioridad de datos, actualizar `docs/DATA-SOURCES.md`.
- Si se incorpora, elimina o cambia una fuente/categoria de asset, actualizar `docs/ASSET-INVENTORY.md`.
- Si cambia el orden o estado de fases, actualizar `docs/ROADMAP.md`.
- La documentacion debe distinguir claramente entre estado actual y plan.
- No mantener informacion obsoleta como si siguiera vigente.

## Idioma

- La documentacion del proyecto debe escribirse en espanol.
- Los nombres de variables, funciones, componentes, tipos, rutas y archivos de codigo deben mantenerse en ingles.
- Los nombres oficiales de librerias, frameworks, APIs y tecnologias no deben traducirse.

## Validacion

Antes de finalizar una tarea:

- Revisar los archivos modificados.
- Comprobar que no se hayan introducido cambios no relacionados.
- Ejecutar typecheck, lint, build o tests relevantes cuando existan y tengan sentido para la tarea.
- Comprobar que el comportamiento implementado coincide con `docs/PRODUCT.md` cuando corresponda.
- Comprobar que la UI coincide con `docs/DESIGN.md` cuando corresponda.
- Comprobar que no se haya duplicado logica autoritativa del motor.
- Validar que nuevos assets tengan procedencia documentada.
- No afirmar que una tarea esta completada sin haber validado el cambio relevante.
