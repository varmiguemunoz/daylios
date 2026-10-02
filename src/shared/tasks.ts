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
  getDay(date: DayKey): Promise<Task[]>
  /** El título puede llevar `#tags` y `!alto|!medio|!bajo` (ver parseCapture). */
  add(date: DayKey, title: string, description?: string): Promise<Task>
  /** Nuevo orden del día: ids en el orden deseado. */
  reorder(date: DayKey, ids: string[]): Promise<Task[]>
  /** Tags usados alguna vez, del más usado al menos usado (para sugerencias). */
  tags(): Promise<string[]>
  update(id: string, patch: TaskPatch): Promise<Task>
  remove(id: string): Promise<void>
  /** Reinserta una tarea borrada (deshacer). */
  restore(task: Task): Promise<Task>
  /** Mueve una tarea a otro día. */
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
