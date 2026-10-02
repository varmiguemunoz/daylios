import type { DayKey } from '@shared/tasks'

const MAX_PAGE_SIZE = 60

export interface DayPage<T> {
  days: { date: DayKey; items: T[] }[]
  page: number
  totalPages: number
  totalDays: number
}

/**
 * Agrupa por día (en el orden en que llegan) y pagina por días.
 * Lo usan el historial de tareas y la lista de notas.
 */
export function pageByDay<T extends { date: DayKey }>(
  items: T[],
  page: number,
  pageSize: number
): DayPage<T> {
  const byDay = new Map<DayKey, T[]>()
  for (const item of items) {
    const list = byDay.get(item.date)
    if (list) list.push(item)
    else byDay.set(item.date, [item])
  }
  const days = [...byDay].map(([date, list]) => ({ date, items: list }))

  const size = clamp(Math.floor(pageSize) || 7, 1, MAX_PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(days.length / size))
  const current = clamp(Math.floor(page) || 1, 1, totalPages)

  return {
    days: days.slice((current - 1) * size, current * size),
    page: current,
    totalPages,
    totalDays: days.length
  }
}

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)
