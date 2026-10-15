export const ACTIVITY_VERBS = [
  'created',
  'updated',
  'deleted',
  'restored',
  'moved',
  'won',
  'lost',
  'completed',
  'assigned',
  'uploaded',
  'renamed',
  'invited',
  'joined',
  'published',
  'paused'
] as const
export type ActivityVerb = (typeof ACTIVITY_VERBS)[number]

export const ACTIVITY_ENTITIES = [
  'clients',
  'projects',
  'meetings',
  'prospects',
  'contacts',
  'tasks',
  'pipelines',
  'file_manifest',
  'members',
  'automations'
] as const
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number]

export const ACTIVITY_PAGE = 500
export const BURST_MS = 60_000

export interface ActivityEntry {
  id: number
  seq: number
  actorId: string | null
  verb: ActivityVerb
  entity: ActivityEntity
  entityId: string
  title: string
  detail: string | null
  targetId: string | null
  count: number
  at: string
}

export interface ActivityPage {
  items: ActivityEntry[]
  cursor: number
  more: boolean
}

export interface ActivityFilter {
  actorId?: string | null
  verb?: ActivityVerb | null
  entity?: ActivityEntity | null
  entityId?: string | null
  limit?: number
}

export interface ActivityState {
  enabled: boolean
  unseen: number
}

export const NOTIFY_KINDS = ['tasks', 'prospects', 'meetings'] as const
export type NotifyKind = (typeof NOTIFY_KINDS)[number]
export type NotifySettings = Record<NotifyKind, boolean>
export const NOTIFY_DEFAULTS: NotifySettings = { tasks: true, prospects: true, meetings: true }
export const NOTIFY_LABEL: Record<NotifyKind, string> = {
  tasks: 'Tareas',
  prospects: 'Prospectos',
  meetings: 'Reuniones'
}

export interface ActivityApi {
  state(): Promise<ActivityState>
  list(filter?: ActivityFilter): Promise<ActivityEntry[]>
  markSeen(): Promise<ActivityState>
  filePath(id: string): Promise<string | null>
  notifications(): Promise<NotifySettings>
  setNotifications(settings: NotifySettings): Promise<NotifySettings>
  onChanged(cb: (state: ActivityState) => void): () => void
}

export const VERB_LABEL: Record<ActivityVerb, string> = {
  created: 'Creó',
  updated: 'Cambió',
  deleted: 'Borró',
  restored: 'Restauró',
  moved: 'Movió de etapa',
  won: 'Ganó',
  lost: 'Perdió',
  completed: 'Completó',
  assigned: 'Asignó',
  uploaded: 'Subió',
  renamed: 'Renombró',
  invited: 'Invitó',
  joined: 'Se unió',
  published: 'Publicó',
  paused: 'Pausó'
}

export const ENTITY_LABEL: Record<ActivityEntity, string> = {
  clients: 'Clientes',
  projects: 'Proyectos',
  meetings: 'Reuniones',
  prospects: 'Prospectos',
  contacts: 'Contactos',
  tasks: 'Tareas',
  pipelines: 'Pipelines',
  file_manifest: 'Archivos',
  members: 'Miembros',
  automations: 'Automatizaciones'
}

const NOUN: Record<ActivityEntity, string> = {
  clients: 'el cliente',
  projects: 'el proyecto',
  meetings: 'la reunión',
  prospects: 'el prospecto',
  contacts: 'el contacto',
  tasks: 'la tarea',
  pipelines: 'el pipeline',
  file_manifest: 'el archivo',
  members: '',
  automations: 'la automatización'
}

export const NOTIFY_KIND_OF: Partial<Record<ActivityEntity, NotifyKind>> = {
  tasks: 'tasks',
  prospects: 'prospects',
  meetings: 'meetings'
}

export const subjectOf = (e: ActivityEntry): string =>
  e.title ? `${NOUN[e.entity]} «${e.title}»`.trim() : NOUN[e.entity]

export function activityPhrase(e: ActivityEntry, name: (userId: string | null) => string): string {
  const who = name(e.actorId)
  const what = subjectOf(e)
  const times = e.count > 1 ? `, ${e.count} veces` : ''
  switch (e.verb) {
    case 'created':
      return `${who} creó ${what}`
    case 'updated':
      return `${who} cambió ${what}${times}`
    case 'deleted':
      return `${who} borró ${what}`
    case 'restored':
      return `${who} restauró ${what}`
    case 'moved':
      return `${who} movió ${what}${e.detail ? ` a ${e.detail}` : ''}`
    case 'won':
      return `${who} ganó ${what}`
    case 'lost':
      return `${who} perdió ${what}`
    case 'completed':
      return `${who} completó ${what}`
    case 'assigned':
      return `${who} asignó ${what} a ${name(e.targetId)}`
    case 'uploaded':
      return `${who} subió ${what}`
    case 'renamed':
      return `${who} renombró ${e.detail ? `«${e.detail}» a «${e.title}»` : what}`
    case 'invited':
      return `${who} invitó a ${e.title === 'enlace' ? 'alguien por enlace' : e.title}`
    case 'joined':
      return `${who} se unió a la organización`
    case 'published':
      return `${who} publicó ${what}${e.detail ? ` ${e.detail}` : ''}`
    case 'paused':
      return `${who} pausó ${what}`
  }
}

export const dayKeyOf = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
