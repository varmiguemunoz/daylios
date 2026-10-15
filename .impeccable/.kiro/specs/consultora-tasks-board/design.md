# Diseño · A2 Tablero de tareas en Consultora

Brief según impeccable `shape`. Modo: **Operate**. El dueño revisa qué está en marcha, mueve lo que
avanzó y abre lo siguiente.

## 1 · Datos

Migración `AddTaskStatusAndLinks`:

| Columna       | Tipo           | Notas                                                   |
| ------------- | -------------- | ------------------------------------------------------- |
| `status`      | text           | `todo`, `doing` o `done`. Se rellena desde `done`.      |
| `client_id`   | text, nullable | Cliente relacionado                                     |
| `project_id`  | text, nullable | Proyecto relacionado; si se fija, el cliente es el suyo |
| `prospect_id` | text, nullable | Prospecto relacionado                                   |

Índices: `(status, date)` y `(client_id)`. Regla única en el servicio: cambiar `status` a `done`
pone `done = true` y `completedAt`; cualquier otro estado pone `done = false` y borra
`completedAt`. Marcar `done` desde el menubar mueve `status` igual. Borrar un cliente o proyecto
deja la tarea sin relación.

## 2 · Servicio

`TaskService` gana:

- `board(filter: TaskBoardFilter): Promise<TaskBoard>`: tareas madre agrupadas por estado, con
  avance de subtareas y nombres de las relaciones resueltos en una sola consulta.
- `setStatus(id, status)`.
- `update` acepta `status`, `client`, `project` y `prospect`.
- `forRecord(kind, id)` para la sección Tareas de las fichas.

Tipos nuevos en `src/shared/tasks.ts`: `TaskStatus`, `TaskBoardFilter`, `TaskBoard`, `TaskLinks`.
Rutas `/tasks/board` y `/tasks/:id/status`; IPC y preload como el resto.

## 3 · Interfaz

```
Tareas                                   [Tablero|Lista] [Filtros 2] [+ Nueva tarea]
Esta semana · 14 abiertas

┌ Pendiente 6 ───────┐ ┌ En curso 3 ────────┐ ┌ Hecha 5 ──────────┐
│ Propuesta Acme     │ │ Landing Byou       │ │ Factura TKP       │
│ hoy · M · #ventas  │ │ ayer · atrasada    │ │ lun               │
│ Acme  ▪▪▪▫ 3/4     │ │ TaoFlow            │ │                   │
└────────────────────┘ └────────────────────┘ └───────────────────┘
```

- **Columnas y tarjetas:** se extraen del Pipeline `KanbanColumn` y `KanbanCard` a
  `consultora/organisms/kanban/`. Pipeline y Tareas los comparten. Mismo estilo Obsidian.
- **Organismos:** `TaskBoardView`, `TaskTable`, `TaskFiltersPanel`, `TaskDrawer`.
- **Molécula:** `TaskCardBody` con título, día, esfuerzo, tags, avance y relación.
- **Detalle:** `TaskDrawer` reutiliza `TaskDetail` en una variante de panel. Arriba, propiedades de
  Estado, Día y Relación con `RefPicker`.
- **Colores:** atrasada en amarillo, estado como etiqueta neutra, la columna Hecha con punto verde.

## 4 · Claude

`update_task` acepta `status`, `client`, `project` y `prospect`. `get_task` y `get_day` devuelven
el estado. `list_tasks` con periodo, estado, texto, tags, cliente y proyecto.

## 5 · Riesgos

- Dos caminos para cerrar una tarea, `done` y `status`. Una sola función del servicio los mantiene
  iguales, con pruebas.
- El techo de 8 por día se valida en el servicio, no en la interfaz.
