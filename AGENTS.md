# AGENTS.md

## Objetivo

Este archivo define cómo debe trabajar la IA dentro del proyecto y qué documentación debe mantener.

## Flujo de trabajo

Antes de modificar código:

1. Entender exactamente el cambio solicitado.
2. Revisar el código existente relacionado.
3. Identificar qué documentación es relevante.
4. Leer solo la documentación necesaria.
5. Modificar únicamente lo necesario.
6. Actualizar la documentación afectada en la misma tarea.
7. Validar el resultado antes de finalizar.

## Carga de contexto

No leer toda la documentación por defecto.

- Leer `docs/PRODUCT.md` cuando cambien funcionalidad, comportamiento, reglas de negocio, usuarios o alcance.
- Leer `docs/ARCHITECTURE.md` cuando cambien arquitectura, backend, Supabase, Vercel, persistencia, seguridad, concurrencia o estructura.
- Leer `docs/DESIGN.md` cuando cambien UI, UX, estilos, layout, responsive, componentes visuales, animaciones o accesibilidad visual.
- Leer `docs/DATA-SOURCES.md` cuando cambien datos Pokémon, formatos, reglas, IDs o integraciones de datos.
- Leer `docs/ASSET-INVENTORY.md` cuando cambien sprites, artwork, iconos, fondos, efectos, manifest o pipeline de assets.
- Para cambios pequeños y aislados, revisar directamente el código relacionado.
- Leer varios documentos solo cuando la tarea afecte realmente a varias áreas.

## Fuentes de verdad

Cada documento tiene una responsabilidad concreta:

- `docs/PRODUCT.md`: qué hace el producto y cuáles son sus reglas/alcance.
- `docs/ARCHITECTURE.md`: cómo está construido técnicamente.
- `docs/DESIGN.md`: cómo debe verse y comportarse visualmente.
- `docs/DATA-SOURCES.md`: de dónde procede cada dato y qué fuente tiene prioridad.
- `docs/ASSET-INVENTORY.md`: origen, sincronización y cobertura de assets.
- El código representa la implementación real actual.

Evitar duplicar información entre documentos. Si código y documentación se contradicen, analizar la discrepancia y corregir lo que haya quedado obsoleto.

## Mantenimiento de documentación

- Cambio de funcionalidad/regla/alcance → actualizar `PRODUCT.md`.
- Cambio técnico/infraestructura/modelo de datos → actualizar `ARCHITECTURE.md`.
- Cambio UI/UX/visual → actualizar `DESIGN.md`.
- Cambio de fuente, mapeo o prioridad de datos → actualizar `DATA-SOURCES.md`.
- Cambio de fuente/categoría/pipeline de assets → actualizar `ASSET-INVENTORY.md`.

**Una tarea no está completa si deja desactualizado alguno de estos documentos.**

La documentación debe describir siempre el estado o decisión actual. Eliminar o sustituir información obsoleta; no mantener histórico dentro de los documentos vivos.

## Decisiones fijas actuales

- Modos: Single Player contra CPU y Private Battle 1v1 por invitación.
- Infraestructura: Next.js/Vercel Functions + Supabase Auth/PostgreSQL/Realtime; sin backend persistente propio ni jugador-host.
- Pokémon Showdown es server-only y autoridad para simulación, RNG, formatos y legalidad.
- Single Player: CPU server-side, partida persistida y autosave tras cada turno confirmado.
- Private Battle: elecciones privadas, resolución única/idempotente y persistencia antes del aviso Realtime.
- Datos competitivos: Showdown; PokéAPI solo complemento.
- Assets: Showdown principal, PokéAPI Sprites fallback.
- Diseño visual: todavía pendiente. No inventar decisiones visuales; cuando se tomen, registrarlas en `DESIGN.md`.

## Reglas generales

- Reutilizar código y patrones existentes.
- No modificar funcionalidad no relacionada.
- No añadir dependencias o infraestructura preventivamente.
- Evitar sobreingeniería y duplicación.
- No implementar funcionalidades fuera de `PRODUCT.md` salvo solicitud explícita.
- No reimplementar reglas que ya resuelve Pokémon Showdown.
- No exponer información oculta del rival ni secretos del backend.

## Configuración

`.env.example` es el contrato actual:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Las `NEXT_PUBLIC_*` son públicas. `SUPABASE_SECRET_KEY` es solo backend. No añadir variables hipotéticas.

## Idioma

- Documentación en español.
- Identificadores de código en inglés.
- Mantener nombres oficiales de librerías, APIs y tecnologías.

## Validación

Antes de finalizar:

- revisar archivos modificados;
- comprobar que no haya cambios no relacionados;
- ejecutar typecheck/lint/build/tests relevantes;
- comprobar `PRODUCT.md` si cambia comportamiento;
- comprobar `ARCHITECTURE.md` si cambia técnica;
- comprobar `DESIGN.md` si cambia UI/UX;
- validar autorización/RLS si se toca Supabase;
- validar idempotencia/concurrencia si se toca resolución de turnos;
- validar que no se filtra información privada;
- no afirmar que algo está implementado sin haberlo verificado.
