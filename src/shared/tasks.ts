/** Techo diario de tareas. */
export const DAILY_LIMIT = 8

/** Fecha local en formato YYYY-MM-DD. */
export type DayKey = string

export interface Task {
  id: string
  title: string
  date: DayKey
  done: boolean
  position: number
  createdAt: string
  completedAt: string | null
  carriedFrom: DayKey | null
  /** Descripción en markdown. null = sin descripción. */
  description: string | null
  /** Tags libres en minúsculas, sin `#`. */
  tags: string[]
  effort: Effort | null
  /** Tarea madre. null = tarea del día (cuenta para el techo). */
  parentId: string | null
  /** Avance de sus subtareas (solo en listas de madres: día e historial). */
  subtasks?: SubtaskProgress
}

export interface SubtaskProgress {
  total: number
  done: number
}

/** Detalle: la tarea, su madre (si es subtarea) y sus subtareas (si es madre). */
export interface TaskView {
  task: Task
  parent: Pick<Task, 'id' | 'title'> | null
  subtasks: Task[]
}

/** Tag de tareas con su uso (tareas y subtareas). */
export interface TaskTagSummary {
  tag: string
  tasks: number
}

/** Lo que se borró, para deshacer (la madre vuelve con todas sus subtareas). */
export interface RemovedTask {
  task: Task
  subtasks: Task[]
}

export type Effort = 'alto' | 'medio' | 'bajo'
export const EFFORTS: Effort[] = ['bajo', 'medio', 'alto']

export const MAX_TAGS = 5

export interface TaskPatch {
  title?: string
  done?: boolean
  /** Cadena vacía borra la descripción. */
  description?: string
  tags?: string[]
  /** null quita el esfuerzo. */
  effort?: Effort | null
}

export interface HistoryQuery {
  from?: DayKey
  to?: DayKey
  page: number
  pageSize: number
}

export interface HistoryDay {
  date: DayKey
  tasks: Task[]
}

export interface HistoryPage {
  days: HistoryDay[]
  page: number
  totalPages: number
  totalDays: number
  totalTasks: number
  doneTasks: number
}

export interface CarryOverResult {
  moved: Task[]
  left: Task[]
}

export interface DaySummary {
  date: DayKey
  limit: number
  total: number
  done: number
  pending: number
  free: number
  tasks: Task[]
}

/** Contrato que la UI consume (vía IPC) y que implementa TaskService. */
export interface TasksApi {
  /** Tareas madre del día, con el avance de sus subtareas. */
  getDay(date: DayKey): Promise<Task[]>
  /** Detalle con madre y subtareas. */
  get(id: string): Promise<TaskView>
  /** El título puede llevar `#tags` y `!alto|!medio|!bajo` (ver parseCapture). */
  add(date: DayKey, title: string, description?: string): Promise<Task>
  /** Subtarea al final de su madre. No cuenta para el techo. */
  addSubtask(parentId: string, title: string, description?: string): Promise<Task>
  /** Nuevo orden de las subtareas: todos los ids de esa madre. */
  reorderSubtasks(parentId: string, ids: string[]): Promise<Task[]>
  /** Marca hechas todas las subtareas pendientes. */
  completeSubtasks(parentId: string): Promise<Task[]>
  /** Nuevo orden del día: ids en el orden deseado. */
  reorder(date: DayKey, ids: string[]): Promise<Task[]>
  /** Tags usados alguna vez, del más usado al menos usado (para sugerencias). */
  tags(): Promise<string[]>
  /** Tags con cuántas tareas los usan (pantalla Tags). */
  tagSummaries(): Promise<TaskTagSummary[]>
  /** Renombra un tag en todas las tareas (si el nuevo ya existe, se fusionan). Devuelve cuántas cambió. */
  renameTag(from: string, to: string): Promise<number>
  /** Quita un tag de todas las tareas. Devuelve cuántas cambió. */
  removeTag(tag: string): Promise<number>
  update(id: string, patch: TaskPatch): Promise<Task>
  /** Borra la tarea (y sus subtareas). Devuelve lo borrado para deshacer. */
  remove(id: string): Promise<RemovedTask>
  /** Reinserta lo borrado (deshacer). */
  restore(removed: RemovedTask): Promise<Task>
  /** Mueve una tarea madre (con sus subtareas) a otro día. */
  moveToDate(id: string, date: DayKey): Promise<Task>
  /** Mueve las pendientes de `from` a `to` mientras haya hueco. */
  carryOver(from: DayKey, to: DayKey): Promise<CarryOverResult>
  history(query: HistoryQuery): Promise<HistoryPage>
}

/** "#Ventas" → "ventas". Vacío si no sirve como tag. */
export function cleanTag(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 24)
}

const EFFORT_TOKENS: Record<string, Effort> = {
  '!alto': 'alto',
  '!a': 'alto',
  '!medio': 'medio',
  '!m': 'medio',
  '!bajo': 'bajo',
  '!b': 'bajo'
}

/**
 * Lo que escribes en el campo de captura → título, tags y esfuerzo.
 * "Propuesta Acme #ventas !alto" → { title: "Propuesta Acme", tags: ["ventas"], effort: "alto" }
 */
export function parseCapture(text: string): { title: string; tags: string[]; effort: Effort | null } {
  const tags: string[] = []
  let effort: Effort | null = null
  const words = text.split(/\s+/).filter((word) => {
    const lower = word.toLowerCase()
    if (EFFORT_TOKENS[lower]) {
      effort = EFFORT_TOKENS[lower]
      return false
    }
    if (/^#[^\s#]+$/.test(word)) {
      const tag = cleanTag(word)
      if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) tags.push(tag)
      return false
    }
    return true
  })
  return { title: words.join(' ').trim(), tags, effort }
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toDayKey(fromDayKey(value)) === value
}

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, delta: number): DayKey {
  const d = fromDayKey(key)
  d.setDate(d.getDate() + delta)
  return toDayKey(d)
}

export function todayKey(): DayKey {
  return toDayKey(new Date())
}
