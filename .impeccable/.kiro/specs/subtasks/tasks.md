# Tareas · Subtareas

- [x] 1. Migración `AddSubtasks` + `parentId` en `TaskModel` y `Task`; tipos `DayTask`, `TaskView`,
      `RemovedTask`
- [x] 2. `TaskService`: `listDay`/`history` solo madres + progreso; `assertRoom`/`carryOver` solo
      madres; `move` arrastra subtareas y rechaza subtareas; `get`, `addSubtask`,
      `reorderSubtasks`, `completeSubtasks`; `remove`/`restore` con subárbol
- [x] 3. Controlador + rutas nuevas; IPC `tasks:get|addSubtask|reorderSubtasks|completeSubtasks`;
      preload
- [x] 4. Tests puros: techo ignora subtareas; mover madre mueve hijas; restaurar madre restaura hijas
- [x] 5. UI: `SubtaskProgress` en `TaskRow` (Hoy e Historial); `TaskRow` `size="compact"`
- [x] 6. UI: `SubtaskCapture` + `SubtaskList` en `TaskDetail`; navegación madre ↔ subtarea en `App`
- [x] 7. UI: «Completar las N pendientes»; deshacer con subárbol en `useDay`
- [x] 8. MCP: `create_task.parent`, `get_task`, `reorder_subtasks`, `complete_subtasks`; `get_day`
      con progreso
- [x] 9. DESIGN.md: fila compacta, progreso, captura pequeña

## Checklist

- [ ] Con 8 tareas en el día, puedo añadir 10 subtareas a una de ellas
- [ ] Mover la madre a mañana lleva sus subtareas; la subtarea sola no se puede mover
- [ ] Clic en subtarea → su detalle → Atrás vuelve a la madre
- [ ] Borrar la madre y ⌘Z: vuelven madre y subtareas en su orden
- [ ] Claude crea una subtarea con `create_task` + `parent` y la ve en `get_task`
