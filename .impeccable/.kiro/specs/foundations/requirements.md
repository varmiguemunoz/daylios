# Requisitos · Fundamentos v3

## Contexto

Los módulos 1 a 8 comparten tres necesidades: avisar «algo pasó» (para automatizaciones), piezas de
UI que hoy no existen (panel lateral, modal, control segmentado) y un MCP de 881 líneas en un solo
archivo que va a crecer al doble. Este módulo prepara eso sin cambiar comportamiento visible.

## R1 · Eventos de dominio

- R1.1 Los servicios publican eventos tipados cuando algo cambia: contacto creado, tag añadido o
  quitado, estado de suscripción cambiado, prospecto creado o cambia de etapa, cliente creado,
  reunión lista, tarea completada.
- R1.2 Un evento se publica **dentro de la misma transacción** que el cambio: si la transacción se
  revierte, el evento no existe.
- R1.3 Cada evento lleva id, tipo, fecha, sujeto (ids) y su causa (ejecución de automatización y
  profundidad) para cortar bucles.
- R1.4 Publicar un evento sin oyentes no cuesta nada ni falla.

## R2 · Primitivas de UI (diseño atómico)

- R2.1 `Drawer`: panel lateral derecho sobre el contenido, se cierra con Esc, clic fuera o botón.
- R2.2 `Modal`: diálogo centrado (patrón de la hoja de grabación), foco atrapado, Esc cierra.
- R2.3 `SegmentedToggle`: control segmentado (p. ej. Columnas | Lista), patrón del tab switcher.
- R2.4 `FilterButton`: pill «Filtros» con contador de filtros activos.
- R2.5 `ConfirmButton`: borrar en dos pasos (patrón actual «¿Borrar?»), reutilizable.
- R2.6 `SearchField`: pill de búsqueda (patrón actual de Contactos).
- R2.7 Accesibles: roles ARIA, foco visible, `prefers-reduced-motion`.

## R3 · MCP modular

- R3.1 `src/mcp/index.ts` solo crea el servidor y registra módulos.
- R3.2 Un archivo por dominio en `src/mcp/tools/`. Cliente HTTP y ayudantes en `src/mcp/client.ts`.
- R3.3 Mismas herramientas, mismos nombres y mismo comportamiento que hoy (refactor puro).

## R4 · Documentación

- R4.1 PRODUCT.md y DESIGN.md actualizados con el alcance v3 (ver ROADMAP).
