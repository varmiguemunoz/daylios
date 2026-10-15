# Tareas · A2 Tablero de tareas en Consultora

## Fase 1 · Datos y servicio

- [x] 1. Tipos `TaskStatus`, `TaskLinks`, `TaskBoardFilter` y `TaskBoard` en `src/shared/tasks.ts`.
- [x] 2. Migración `AddTaskStatusAndLinks` con relleno desde `done` e índices; modelo actualizado.
- [x] 3. `setStatus`, `board`, `forRecord` y `update` con estado y relación. Pruebas de la regla
      `done` igual a Hecha, del techo de 8 y de borrar un cliente relacionado.
- [x] 4. Rutas, controlador, IPC y preload.

## Fase 2 · Piezas compartidas

- [x] 5. Extraer `KanbanColumn` y `KanbanCard` del Pipeline a `organisms/kanban`; el Pipeline los usa.
- [x] 6. `TaskCardBody` y `TaskTable`.

## Fase 3 · Pantalla

- [x] 7. Sección «Tareas» en `sections.ts`, pantalla `Tasks` con Tablero y Lista.
- [x] 8. Arrastrar entre columnas, «+» por columna y «Nueva tarea» con el aviso del techo.
- [x] 9. `TaskFiltersPanel` con periodo, texto, tags, esfuerzo, cliente y proyecto.
- [x] 10. `TaskDrawer` con `TaskDetail`, estado, día y relación.
- [x] 11. Sección «Tareas» en las fichas de cliente, proyecto y prospecto.

## Fase 4 · Claude y cierre

- [x] 12. MCP: estado y relación en las herramientas existentes; `list_tasks`.
- [x] 13. Revisión estática; DESIGN.md, PRODUCT.md, README y docs de MCP.

## Checklist

- [ ] Creo una tarea en el menubar y aparece en Pendiente sin recargar
- [ ] La arrastro a En curso y luego a Hecha: en el menubar sale tachada
- [ ] Desmarco en el menubar y vuelve a Pendiente en el tablero
- [ ] Relaciono una tarea con Acme y la veo en la ficha de Acme
- [ ] Intento crear la novena tarea de hoy y me ofrece mañana
- [ ] Le pido a Claude «qué tengo en curso» y responde con el tablero

## Notas de la implementación

- R3.2 cubierto: la Lista ordena por cualquier columna pulsando la cabecera, y el orden se recuerda en `tasks.sort`.
