# Requisitos · Subtareas

## Contexto

Hay tareas del día que engloban mucho trabajo. Hoy se parten en una descripción con casillas; el
dueño quiere subtareas de verdad, que funcionen igual que una tarea (detalle, markdown, tags,
esfuerzo) sin romper el techo de 8.

Decisiones: un nivel, sin límite de cantidad, no cuentan para el techo.

## R1 · Qué es una subtarea

- R1.1 Una subtarea es una `Task` con `parentId`. Tiene título (markdown en línea), descripción
  markdown, hecha/pendiente, tags y esfuerzo, igual que una tarea.
- R1.2 Una subtarea no puede tener subtareas (un nivel). Una tarea con subtareas no puede pasar a
  ser subtarea.
- R1.3 Sin límite de subtareas por tarea.

## R2 · Techo y días

- R2.1 Las subtareas **no cuentan** para el techo de 8 (ni al crear, ni al traer de ayer, ni al mover).
- R2.2 Una subtarea vive en el día de su tarea madre. Mover la madre de día (mover, traer de ayer,
  carry-over de Claude) mueve todas sus subtareas.
- R2.3 Una subtarea no se mueve sola de día.

## R3 · Hoy e Historial

- R3.1 Las listas del día y del historial muestran solo tareas madre.
- R3.2 Una madre con subtareas muestra su avance (`2/5`) en la fila.
- R3.3 El medidor de 8 segmentos no cambia (cuenta solo madres).

## R4 · Detalle

- R4.1 El detalle de una tarea madre tiene una sección «Subtareas»: campo de captura (acepta `#tags`
  y `!alto|!medio|!bajo`), lista ordenable (arrastrar, ⌥↑/⌥↓), completar con el círculo o Espacio.
- R4.2 Clic o Enter en una subtarea abre su detalle: la misma pantalla de tarea, sin sección de
  subtareas, con «Atrás» que vuelve a la madre (`← <título de la madre>`) y la línea «Subtarea de …».
- R4.3 Desde el detalle de la subtarea se puede borrar (con Deshacer).
- R4.4 Si la madre está hecha y quedan subtareas pendientes, la sección ofrece «Completar las N
  pendientes». Completar la madre no completa sus subtareas sola.

## R5 · Borrar y deshacer

- R5.1 Borrar una tarea madre borra sus subtareas. «Deshacer» restaura la madre y todas sus
  subtareas tal como estaban.
- R5.2 Borrar una subtarea tiene su propio «Deshacer».

## R6 · Claude (MCP)

- R6.1 `create_task` acepta `parent` (id) para crear una subtarea.
- R6.2 `get_task` devuelve la tarea con sus subtareas (o la madre si es subtarea).
- R6.3 `get_day` y `get_history` incluyen el avance de subtareas de cada tarea.
- R6.4 `reorder_subtasks`; `update_task` y `delete_task` funcionan con subtareas; `move_task` y
  `carry_over_pending` mueven madres con sus subtareas y rechazan mover una subtarea sola.
