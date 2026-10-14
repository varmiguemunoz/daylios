import { dayKeyOf, type ActivityEntry } from '@shared/activity'
import type { OrgMember } from '@shared/organizations'

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

export function dayLabel(key: string, now = new Date()): string {
  const today = dayKeyOf(now.toISOString())
  const yesterday = dayKeyOf(new Date(now.getTime() - 86_400_000).toISOString())
  if (key === today) return 'Hoy'
  if (key === yesterday) return 'Ayer'
  const label = dayFmt.format(new Date(`${key}T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function groupByDay(items: ActivityEntry[]): { key: string; items: ActivityEntry[] }[] {
  const groups: { key: string; items: ActivityEntry[] }[] = []
  for (const e of items) {
    const key = dayKeyOf(e.at)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(e)
    else groups.push({ key, items: [e] })
  }
  return groups
}

export function namer(members: OrgMember[]): (id: string | null) => string {
  return (id) => {
    if (!id) return 'Alguien'
    const m = members.find((x) => x.userId === id)
    return m?.name?.split(/\s+/)[0] ?? m?.email ?? 'Antiguo miembro'
  }
}
