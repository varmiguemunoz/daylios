export const DAILY_LIMIT = 8

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

  description: string | null

  tags: string[]
  effort: Effort | null

  parentId: string | null

  status: TaskStatus

  clientId: string | null
  projectId: string | null
  prospectId: string | null
  assigneeId: string | null

  subtasks?: SubtaskProgress

  links?: TaskLinkNames
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done']
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Pendiente',
  doing: 'En curso',
  done: 'Hecha'
}

export interface TaskLinkNames {
  client?: { id: string; name: string }
  project?: { id: string; name: string }
  prospect?: { id: string; company: string }
}

export interface TaskBoardQuery {
  from?: DayKey
  to?: DayKey

  onlyOpen?: boolean

  query?: string
  tags?: string[]
  effort?: Effort
  client?: string
  project?: string
  prospect?: string
  assignee?: string
}

export type TaskRecordKind = 'client' | 'project' | 'prospect'

export interface SubtaskProgress {
  total: number
  done: number
}

export interface TaskView {
  task: Task
  parent: Pick<Task, 'id' | 'title'> | null
  subtasks: Task[]
}

export interface TaskTagSummary {
  tag: string
  tasks: number
}

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

  status?: TaskStatus

  client?: string
  project?: string
  prospect?: string
  assignee?: string

  description?: string
  tags?: string[]

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

export interface TasksApi {
  getDay(date: DayKey): Promise<Task[]>

  get(id: string): Promise<TaskView>

  add(date: DayKey, title: string, description?: string): Promise<Task>

  addSubtask(parentId: string, title: string, description?: string): Promise<Task>

  reorderSubtasks(parentId: string, ids: string[]): Promise<Task[]>

  completeSubtasks(parentId: string): Promise<Task[]>

  reorder(date: DayKey, ids: string[]): Promise<Task[]>

  tags(): Promise<string[]>

  tagSummaries(): Promise<TaskTagSummary[]>

  renameTag(from: string, to: string): Promise<number>

  removeTag(tag: string): Promise<number>
  update(id: string, patch: TaskPatch): Promise<Task>

  remove(id: string): Promise<RemovedTask>

  restore(removed: RemovedTask): Promise<Task>

  moveToDate(id: string, date: DayKey): Promise<Task>

  carryOver(from: DayKey, to: DayKey): Promise<CarryOverResult>
  history(query: HistoryQuery): Promise<HistoryPage>

  board(query: TaskBoardQuery): Promise<Task[]>

  forRecord(kind: TaskRecordKind, id: string): Promise<Task[]>
}

export function cleanTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24)
}

const EFFORT_TOKENS: Record<string, Effort> = {
  '!alto': 'alto',
  '!a': 'alto',
  '!medio': 'medio',
  '!m': 'medio',
  '!bajo': 'bajo',
  '!b': 'bajo'
}

export function parseCapture(text: string): {
  title: string
  tags: string[]
  effort: Effort | null
} {
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

export type TaskPeriod = 'today' | 'week' | 'overdue' | 'upcoming' | 'open' | 'range'

export const TASK_PERIODS: { id: TaskPeriod; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'upcoming', label: 'Próximas' },
  { id: 'open', label: 'Todas las abiertas' },
  { id: 'range', label: 'Rango' }
]

export function weekStart(key: DayKey): DayKey {
  const weekday = (fromDayKey(key).getDay() + 6) % 7
  return addDays(key, -weekday)
}

export function periodQuery(
  period: TaskPeriod,
  today: DayKey,
  range: { from: DayKey; to: DayKey }
): Pick<TaskBoardQuery, 'from' | 'to' | 'onlyOpen'> {
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const from = weekStart(today)
      return { from, to: addDays(from, 6) }
    }
    case 'overdue':
      return { to: addDays(today, -1), onlyOpen: true }
    case 'upcoming':
      return { from: addDays(today, 1) }
    case 'open':
      return { onlyOpen: true }
    case 'range':
      return range.from <= range.to
        ? { from: range.from, to: range.to }
        : { from: range.to, to: range.from }
  }
}

export const isOverdue = (t: Pick<Task, 'date' | 'status'>, today: DayKey): boolean =>
  t.status !== 'done' && t.date < today
