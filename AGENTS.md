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

- Leer `docs/PRODUCT.md` cuando la tarea afecte a funcionalidad, comportamiento, reglas de negocio, usuarios o alcance.
- Leer `docs/ARCHITECTURE.md` cuando afecte a arquitectura, flujo de datos, backend, Supabase, WebSockets, base de datos o estructura.
- Leer `docs/DESIGN.md` cuando afecte a UI, UX, responsive, componentes o animaciones.
- Leer `docs/DATA-SOURCES.md` cuando afecte a datos Pokémon, formatos, reglas, sincronizacion o IDs.
- Leer `docs/ASSET-INVENTORY.md` cuando afecte a sprites, artwork, iconos, fondos, efectos o pipeline de assets.
- Para cambios pequenos y aislados, revisar directamente el codigo relacionado.

## Reglas generales

- Reutilizar codigo existente antes de crear nuevas abstracciones.
- Seguir los patrones existentes.
- No modificar funcionalidad no relacionada.
- No introducir dependencias salvo que sean necesarias.
- No duplicar logica.
- Mantener los cambios claros y enfocados.
- Evitar sobreingenieria.
- No implementar funcionalidades fuera de `docs/PRODUCT.md` salvo solicitud explicita.

## Decisiones fijas del proyecto

Estas decisiones no deben cambiarse sin una instruccion explicita del usuario.

### Combate

- Pokémon Showdown es la autoridad de mecanicas.
- El servidor es autoritativo.
- El frontend nunca decide daño, RNG, victoria, prioridad o legalidad.
- La validacion final de equipos usa `TeamValidator`.
- Random Battle se genera en servidor.
- El cliente no debe depender directamente del protocolo interno de Showdown.
- La integracion con Showdown debe quedar encapsulada en `battle-engine`.

### Base de datos y autenticacion

- **Supabase es la plataforma elegida y definitiva para el proyecto.**
- Supabase Auth gestiona usuarios y sesiones.
- PostgreSQL de Supabase almacena datos persistentes.
- Usar RLS para datos pertenecientes a usuarios.
- La service role key es solo de servidor.
- Nunca exponer secretos en variables `NEXT_PUBLIC_*`.
- Supabase Realtime no sustituye al game server para las battles.

### Tiempo real

Las battles activas se gestionan en el game server propio mediante WebSockets.

Supabase se utiliza para persistencia, no como motor de estado en tiempo real de la partida.

### Data sources

Prioridad fija:

1. Pokémon Showdown para datos competitivos, reglas y mecanicas.
2. PokéAPI solo para informacion complementaria de Pokédex.
3. Ante conflicto funcional, gana Pokémon Showdown.

No duplicar manualmente:

- learnsets;
- bans;
- clauses;
- formulas de daño;
- prioridad;
- reglas de estados;
- interacciones de abilities/items;
- mecanicas por generacion.

### Assets

Fuente principal:

- Play Pokémon Showdown / assets de Showdown.

Fallback:

- PokéAPI Sprites.

Los assets externos deben sincronizarse mediante scripts y consumirse localmente. No introducir hotlinks directamente en componentes.

## Fuentes de verdad

- `docs/PRODUCT.md`: producto y alcance.
- `docs/ARCHITECTURE.md`: arquitectura y decisiones tecnicas.
- `docs/DESIGN.md`: UI/UX.
- `docs/DATA-SOURCES.md`: origen y prioridad de datos.
- `docs/ASSET-INVENTORY.md`: assets, estructura, fuentes y cobertura.
- El codigo representa la implementacion real.

Si codigo y documentacion se contradicen, analizar la discrepancia y actualizar lo necesario.

## Mantenimiento de documentacion

- Cambio de producto -> `PRODUCT.md`.
- Cambio de arquitectura/Supabase/WebSocket -> `ARCHITECTURE.md`.
- Cambio visual -> `DESIGN.md`.
- Cambio de datos/fuentes -> `DATA-SOURCES.md`.
- Cambio de assets -> `ASSET-INVENTORY.md`.

## Idioma

- Documentacion en espanol.
- Variables, funciones, componentes, tipos, rutas y archivos de codigo en ingles.
- No traducir nombres oficiales de tecnologias o APIs.

## Variables de entorno

- Usar `.env.example` como contrato de configuracion.
- Nunca introducir credenciales reales en archivos versionados.
- No renombrar variables de entorno existentes sin actualizar todos sus consumidores y documentacion.
- Las variables con prefijo `NEXT_PUBLIC_` se consideran publicas.

## Validacion

Antes de finalizar:

- revisar archivos modificados;
- comprobar que no haya cambios no relacionados;
- ejecutar typecheck/lint/build/tests relevantes cuando existan;
- comprobar producto contra `PRODUCT.md`;
- comprobar UI contra `DESIGN.md`;
- comprobar que no se duplica logica de Showdown;
- comprobar que los datos persistentes respetan autorizacion/RLS;
- comprobar que nuevos assets usan el pipeline definido;
- no afirmar finalizacion sin validar el cambio.
