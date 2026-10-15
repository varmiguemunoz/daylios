import { num, str } from './catalog'
import type { Params, TimeWindow } from './model'

function at(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0)
  return d
}

function lastDay(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function nextRun(params: Params, after: Date): Date | null {
  const time = str(params, 'time')
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null
  const frequency = str(params, 'frequency') || 'daily'
  for (let i = 0; i <= 366; i++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + i)
    const candidate = at(day, time)
    if (candidate <= after) continue
    const weekday = candidate.getDay()
    if (frequency === 'daily') {
      if (params.skipWeekends === true && (weekday === 0 || weekday === 6)) continue
      return candidate
    }
    if (frequency === 'weekly') {
      if (weekday === (num(params, 'weekday') ?? 1)) return candidate
      continue
    }
    const wanted = Math.min(
      num(params, 'monthday') ?? 1,
      lastDay(day.getFullYear(), day.getMonth())
    )
    if (candidate.getDate() === wanted) return candidate
  }
  return null
}

export function nextRuns(params: Params, after: Date, count: number): Date[] {
  const out: Date[] = []
  let cursor = after
  while (out.length < count) {
    const next = nextRun(params, cursor)
    if (!next) break
    out.push(next)
    cursor = next
  }
  return out
}

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export function nextWindowOpen(window: TimeWindow | null, now: Date): Date | null {
  if (!window || window.days.length === 0) return null
  const start = minutesOf(window.start)
  const end = minutesOf(window.end)
  const current = now.getHours() * 60 + now.getMinutes()
  if (window.days.includes(now.getDay()) && current >= start && current < end) return null
  for (let i = 0; i <= 7; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    if (!window.days.includes(day.getDay())) continue
    const open = new Date(day)
    open.setHours(Math.floor(start / 60), start % 60, 0, 0)
    if (open > now) return open
  }
  return null
}
