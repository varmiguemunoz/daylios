import type { DayKey } from '@shared/tasks'
import { addDays, fromDayKey } from '@shared/tasks'

const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' })
const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' })
const shortDay = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short'
})

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function weekdayName(key: DayKey): string {
  return cap(weekday.format(fromDayKey(key)))
}

export function longDate(key: DayKey): string {
  return dayMonth.format(fromDayKey(key))
}

/** "Hoy", "Ayer" o "Lun, 28 sept" */
export function relativeDay(key: DayKey, today: DayKey): string {
  if (key === today) return 'Hoy'
  if (key === addDays(today, -1)) return 'Ayer'
  return cap(shortDay.format(fromDayKey(key)).replace('.', ''))
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

const clock = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

/** "14:32" a partir de una fecha ISO. */
export function timeOf(iso: string): string {
  return clock.format(new Date(iso))
}
