import {
  DAILY_LIMIT,
  addDays,
  type DayKey,
  type Effort,
  type Task,
  type TaskBoardQuery
} from '@shared/tasks'
import { tasksApi } from '../../../lib/api'
import { relativeDay } from '../../../lib/format'

export const TASK_DRAG = 'application/x-daylios-task'

export interface TaskFilters {
  query: string
  tags: string[]
  effort: Effort | ''
  client: string
  project: string
  mine?: boolean
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  query: '',
  tags: [],
  effort: '',
  client: '',
  project: ''
}

export const activeTaskFilters = (f: TaskFilters): number =>
  [f.query.trim(), f.tags.length, f.effort, f.client, f.project, f.mine].filter(Boolean).length

export const isTaskFilters = (v: unknown): boolean =>
  !!v && typeof v === 'object' && Array.isArray((v as TaskFilters).tags)

export function filterQuery(f: TaskFilters, me: string | null = null): TaskBoardQuery {
  return {
    assignee: f.mine && me ? me : undefined,
    query: f.query.trim() || undefined,
    tags: f.tags.length ? f.tags : undefined,
    effort: f.effort || undefined,
    client: f.client || undefined,
    project: f.project || undefined
  }
}

export function dayLabel(date: DayKey, today: DayKey): string {
  if (date === addDays(today, 1)) return 'Mañana'
  return relativeDay(date, today)
}

export async function nextFreeDay(from: DayKey): Promise<DayKey | null> {
  for (let i = 0; i < 30; i++) {
    const day = addDays(from, i)
    if ((await tasksApi.getDay(day)).length < DAILY_LIMIT) return day
  }
  return null
}

export function linkName(t: Task): string | null {
  return t.links?.project?.name ?? t.links?.client?.name ?? t.links?.prospect?.company ?? null
}

export const isDayFull = (message: string | null): boolean =>
  !!message && /ya tiene \d+ tareas/.test(message)
