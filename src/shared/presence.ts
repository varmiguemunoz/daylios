export interface PresenceView {
  entity: string
  id: string
}

export interface PresenceMember {
  userId: string
  name: string | null
  initials: string
  view: PresenceView | null
  editing: boolean
  at: number
}

export interface PresenceState {
  enabled: boolean
  hidden: boolean
  members: PresenceMember[]
}

export const PRESENCE_TTL_MS = 60_000
export const PRESENCE_BEAT_MS = 25_000
export const EDIT_IDLE_MS = 2_000

export const presenceTopic = (orgId: string): string => `org:${orgId}:presence`

export const sameView = (a: PresenceView | null, b: PresenceView | null): boolean =>
  !!a && !!b && a.entity === b.entity && a.id === b.id

const isView = (v: unknown): v is PresenceView =>
  !!v &&
  typeof (v as PresenceView).entity === 'string' &&
  typeof (v as PresenceView).id === 'string'

export function toMember(raw: unknown): PresenceMember | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.userId !== 'string' || typeof r.at !== 'number') return null
  return {
    userId: r.userId,
    name: typeof r.name === 'string' ? r.name.slice(0, 80) : null,
    initials: typeof r.initials === 'string' ? r.initials.slice(0, 3) : '·',
    view: isView(r.view)
      ? { entity: r.view.entity.slice(0, 40), id: r.view.id.slice(0, 300) }
      : null,
    editing: r.editing === true,
    at: r.at
  }
}

export function onlineMembers(raw: unknown[], me: string | null, now: number): PresenceMember[] {
  const byUser = new Map<string, PresenceMember>()
  for (const item of raw) {
    const m = toMember(item)
    if (!m || m.userId === me || now - m.at > PRESENCE_TTL_MS) continue
    const known = byUser.get(m.userId)
    if (!known || m.at > known.at) byUser.set(m.userId, m)
  }
  return [...byUser.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

export interface PresenceApi {
  state(): Promise<PresenceState>
  setView(view: PresenceView | null): void
  setEditing(editing: boolean): void
  setHidden(hidden: boolean): Promise<PresenceState>
  onChanged(cb: (state: PresenceState) => void): () => void
}
