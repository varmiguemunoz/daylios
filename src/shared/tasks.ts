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
}

export interface TaskPatch {
  title?: string
  done?: boolean
  /** Cadena vacía borra la descripción. */
  description?: string
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
  add(date: DayKey, title: string, description?: string): Promise<Task>
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
