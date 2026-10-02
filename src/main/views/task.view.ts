import { DAILY_LIMIT, type DayKey, type DaySummary, type Task } from '@shared/tasks'

export function taskView(t: Task): Task {
  return {
    id: t.id,
    title: t.title,
    date: t.date,
    done: t.done,
    position: t.position,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    carriedFrom: t.carriedFrom,
    description: t.description ?? null,
    tags: t.tags ?? [],
    effort: t.effort ?? null
  }
}

/** Tareas del día + resumen para que Claude decida si pedir más. */
export function dayView(date: DayKey, tasks: Task[]): DaySummary {
  const done = tasks.filter((t) => t.done).length
  return {
    date,
    limit: DAILY_LIMIT,
    total: tasks.length,
    done,
    pending: tasks.length - done,
    free: Math.max(0, DAILY_LIMIT - tasks.length),
    tasks: tasks.map(taskView)
  }
}

export function errorView(message: string, code?: string): { error: string; code?: string } {
  return code ? { error: message, code } : { error: message }
}
