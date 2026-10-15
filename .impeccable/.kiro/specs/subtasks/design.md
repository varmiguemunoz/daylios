# Diseño · Subtareas

## Modelo

Migración `AddSubtasks1728200000000`:

```sql
ALTER TABLE tasks ADD COLUMN parent_id TEXT NULL;
CREATE INDEX idx_tasks_parent ON tasks (parent_id, position);
```

Sin FK en SQLite (el borrado en cascada lo hace el servicio, dentro de la transacción).

`src/shared/tasks.ts`:

```ts
export interface Task {
  /* … */ parentId: string | null
}
export interface SubtaskProgress {
  total: number
  done: number
}
/** Tarea madre en listas (Hoy, Historial). */
export interface DayTask extends Task {
  subtasks: SubtaskProgress
}
export interface TaskView {
  task: Task
  parent: Pick<Task, 'id' | 'title'> | null
  subtasks: Task[]
}
/** Lo que se borró (para deshacer). */
export interface RemovedTask {
  task: Task
  subtasks: Task[]
}

export interface TasksApi {
  getDay(date): Promise<DayTask[]>
  get(id: string): Promise<TaskView>
  addSubtask(parentId: string, title: string): Promise<Task>
  reorderSubtasks(parentId: string, ids: string[]): Promise<Task[]>
  completeSubtasks(parentId: string): Promise<Task[]>
  remove(id: string): Promise<RemovedTask>
  restore(removed: RemovedTask): Promise<Task>
  // resto igual
}
```

`HistoryDay.tasks` pasa a `DayTask[]`.

## Servicio (`TaskService`)

- `listDay`: `where: { date, parentId: IsNull() }` + progreso con una consulta agrupada
  (`SELECT parent_id, COUNT(*), SUM(done) … WHERE parent_id IN (…) GROUP BY parent_id`).
- `assertRoom` y `carryOver`: cuentan solo `parentId IS NULL`.
- `move(tasks, task, date)`: si es subtarea → `AppError('invalid', 'Mueve la tarea madre.')`;
  si es madre → `update({ parentId: task.id }, { date })` en la misma transacción.
- `addSubtask(parentId, title)`: madre existe y `parentId === null`; `date = madre.date`;
  `position = max(position de sus subtareas) + 1`; `parseCapture` igual que `add`. No llama a
  `assertRoom`.
- `reorderSubtasks`: mismo contrato que `reorder` (lista completa de ids de esa madre).
- `remove(id)`: devuelve `{ task, subtasks }` y borra ambos. `restore(removed)`: reinserta madre (con
  `assertRoom` si es madre) y subtareas tal cual.
- `history`: filtra madres y añade progreso (misma consulta agrupada).
- `tags()`: incluye subtareas (ya lo hace al leer todas).
- `update` con `done: true` emite `task.completed` (módulo foundations).

API HTTP nueva: `GET /tasks/:id`, `POST /tasks/:id/subtasks`, `POST /tasks/:id/subtasks/reorder`,
`POST /tasks/:id/subtasks/complete`. `POST /tasks` acepta `parent`.

## UI (menubar)

Navegación (`App.tsx`): `Screen` de tarea pasa a
`{ name: 'task'; task: Task; from: 'today' | 'history'; parent?: Task }`. Abrir una subtarea apila
la madre en `parent`; «Atrás» desde la subtarea vuelve al detalle de la madre.

Componentes (atómico, por props):

- `molecules/SubtaskProgress` · micro pill `2/5` en `TaskRow` (milk-soft; mint cuando todas hechas).
- `organisms/SubtaskList` · usa `TaskRow` con prop `size="compact"` (min 40px, círculo 20px) y
  `useReorder` con grupo = id de la madre.
- `molecules/SubtaskCapture` · variante pequeña del capture field (48px, radio md), placeholder
  «Añadir subtarea · #tag !alto».
- `TaskDetail` recibe `parent?: Pick<Task,'id'|'title'>` y `subtasks?: Task[]`; si es subtarea no
  muestra la sección; muestra «Subtarea de <título>» en la línea de meta.

Brief impeccable (Operate): la sección vive entre los tags y la descripción; la captura es la
primera cosa enfocable con Tab tras el título; cero modales; la fila de subtarea es la misma fila de
siempre a menor escala, para que se lea como «parte de» y no como otra cosa.

Deshacer (`useDay`): `remove` guarda el `RemovedTask` y `restore` lo reinserta completo.

## MCP

`create_task { date, title, description?, parent? }` · `get_task { id }` · `reorder_subtasks
{ parent, ids }` · `complete_subtasks { parent }`. `get_day`/`get_history` devuelven `subtasks`.
