// ---- Contactos ----

export type ContactStatus = 'none' | 'subscribed' | 'unsubscribed' | 'bounced' | 'complained'
export const CONTACT_STATUSES: ContactStatus[] = [
  'none',
  'subscribed',
  'unsubscribed',
  'bounced',
  'complained'
]

export const STATUS_LABELS: Record<ContactStatus, string> = {
  none: 'Sin marketing',
  subscribed: 'Suscrito',
  unsubscribed: 'Dado de baja',
  bounced: 'Su email rebotó',
  complained: 'Marcó un email como spam'
}

export type FieldValue = string | number | boolean | null
export type ContactFields = Record<string, FieldValue>

export type ContactEventType =
  | 'lead' // entró por una fuente
  | 'subscribed'
  | 'status' // baja, rebote o queja
  | 'tag_added'
  | 'tag_removed'
  | 'promoted' // pasó a pipeline
  | 'sync_error'

export interface ContactEvent {
  id: string
  contactId: string
  type: ContactEventType
  detail: Record<string, FieldValue>
  createdAt: string
}

// ---- Tags ----

export interface Tag {
  id: string

  slug: string
  name: string

  segmentId: string | null

  audience: boolean
  createdAt: string
}

export type TagRef = Pick<Tag, 'slug' | 'name'>

export interface TagSummary extends Tag {
  contacts: number
  subscribed: number
}

export interface TagUsage {
  slug: string
  contacts: number
  rules: { id: string; name: string; active: boolean }[]
  sources: string[]
}

// ---- Fuentes (webhooks de entrada) ----

export interface LeadSource {
  id: string
  slug: string
  name: string

  secret: string

  defaultTags: string[]
  receivedCount: number
  lastReceivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type LeadSourceInput = Partial<Pick<LeadSource, 'name' | 'defaultTags'>> & { slug?: string }

// ---- Reglas ----

export type RuleAction =
  | { type: 'add_tag'; tag: string }
  | { type: 'remove_tag'; tag: string }
  | { type: 'fire_event'; event: string }
  | { type: 'promote'; stage: string }

export const RULE_ACTION_TYPES: RuleAction['type'][] = [
  'add_tag',
  'remove_tag',
  'fire_event',
  'promote'
]

export interface Rule {
  id: string
  name: string
  position: number
  active: boolean

  triggerTag: string
  actions: RuleAction[]
  createdAt: string
  updatedAt: string
}

export type RuleInput = Partial<Pick<Rule, 'name' | 'active' | 'triggerTag' | 'actions'>>

// ---- Secuencias (Automations de Resend) ----

export interface SequenceSummary {
  id: string
  name: string
  status: 'enabled' | 'disabled'

  event: string | null
  emails: number
  createdAt: string
  url: string
}

export interface SequenceEmailInput {
  wait?: string
  subject: string
  html: string
}

export interface SequenceInput {
  name: string
  event: string
  emails: SequenceEmailInput[]

  enabled?: boolean
}

// ---- Newsletter ----

export type NewsletterStatus = 'sending' | 'scheduled' | 'sent' | 'failed'

export interface Newsletter {
  id: string

  day: string
  tag: string
  subject: string
  html: string
  status: NewsletterStatus
  broadcastId: string | null
  error: string | null
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

export type NewsletterBrief = Omit<Newsletter, 'html'>

export interface NewsletterInput {
  tag: string
  subject: string
  html: string

  scheduledAt?: string
}

export interface NewsletterContext {
  paused: boolean
  sentToday: boolean
  recent: { day: string; tag: string; subject: string; status: NewsletterStatus }[]
  tags: { slug: string; name: string; subscribed: number }[]
}

// ---- Estado de la sincronización ----

export interface MarketingStatus {
  resendConfigured: boolean
  hubConfigured: boolean

  pending: number
  failing: number
  lastPullAt: string | null
  lastError: string | null
}

// ---- Contrato de la ventana (IPC `marketing:*`; los mismos servicios sirven `/marketing/*`) ----

export interface MarketingApi {
  listTags(): Promise<TagSummary[]>

  renameTag(slug: string, name: string): Promise<Tag>

  setTagAudience(slug: string, audience: boolean): Promise<Tag>
  tagUsage(slug: string): Promise<TagUsage>

  removeTag(slug: string): Promise<void>

  status(): Promise<MarketingStatus>

  syncNow(): Promise<MarketingStatus>
  testResend(): Promise<{ ok: boolean; message: string }>

  listSources(): Promise<LeadSource[]>
  createSource(input: LeadSourceInput): Promise<LeadSource>
  updateSource(slug: string, patch: LeadSourceInput): Promise<LeadSource>

  rotateSourceSecret(slug: string): Promise<LeadSource>
  removeSource(slug: string): Promise<void>

  testHub(): Promise<{ ok: boolean; message: string }>

  listRules(): Promise<Rule[]>
  createRule(input: RuleInput): Promise<Rule>
  updateRule(id: string, patch: RuleInput): Promise<Rule>
  removeRule(id: string): Promise<void>

  reorderRules(ids: string[]): Promise<Rule[]>

  listSequences(): Promise<SequenceSummary[]>
  setSequenceStatus(id: string, enabled: boolean): Promise<SequenceSummary>

  listNewsletters(): Promise<NewsletterBrief[]>
  getNewsletter(id: string): Promise<Newsletter>
  newsletterContext(): Promise<NewsletterContext>
  setNewsletterPaused(paused: boolean): Promise<{ paused: boolean }>
}

// ---- Payload único de los webhooks ----

export interface LeadPayload {
  email: string
  name: string | null
  tags: string[]
  fields: ContactFields
}

// ---- Utilidades ----

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (value: string): string => value.trim().toLowerCase()

export const isEmail = (value: string): boolean => value.length <= 254 && EMAIL.test(value)

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const sourceTag = (sourceSlug: string): string => `origen-${sourceSlug}`

export const tagEvent = (slug: string): string => `tag.${slug}`

export const segmentName = (slug: string): string => `tag:${slug}`

export const LEAD_CREATED = 'lead.created'

export const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}'

export function withUnsubscribeFooter(html: string): string {
  if (html.includes(UNSUBSCRIBE_PLACEHOLDER)) return html
  const footer =
    '<p style="margin-top:32px;font-size:12px;color:#888">' +
    `¿No quieres recibir más emails? <a href="${UNSUBSCRIBE_PLACEHOLDER}">Darse de baja</a>.</p>`
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${footer}</body>`)
    : `${html}\n${footer}`
}

export const contactLabel = (c: { name: string | null; email: string | null }): string =>
  c.name || c.email || 'Sin nombre'

export function cleanTags(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  for (const v of values) {
    const slug = typeof v === 'string' ? slugify(v) : ''
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

export function parseLeadPayload(body: unknown): LeadPayload | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { error: 'El cuerpo debe ser un objeto JSON.' }
  const b = body as Record<string, unknown>
  const email = typeof b.email === 'string' ? normalizeEmail(b.email) : ''
  if (!isEmail(email)) return { error: 'Falta un email válido.' }

  let name: string | null = null
  if (b.name !== undefined && b.name !== null) {
    if (typeof b.name !== 'string') return { error: '«name» debe ser texto.' }
    name = b.name.trim().slice(0, 200) || null
  }

  if (b.tags !== undefined && !Array.isArray(b.tags)) return { error: '«tags» debe ser una lista.' }
  const tags = cleanTags(b.tags).slice(0, 20)

  const fields: ContactFields = {}
  if (b.fields !== undefined && b.fields !== null) {
    if (typeof b.fields !== 'object' || Array.isArray(b.fields))
      return { error: '«fields» debe ser un objeto.' }
    const entries = Object.entries(b.fields as Record<string, unknown>)
    if (entries.length > 50) return { error: '«fields» admite como máximo 50 claves.' }
    for (const [key, value] of entries) {
      const k = key.trim().slice(0, 60)
      if (!k) continue
      if (value === null || typeof value === 'number' || typeof value === 'boolean')
        fields[k] = value
      else if (typeof value === 'string') fields[k] = value.slice(0, 2000)
      else return { error: `«fields.${k}» debe ser texto, número o booleano.` }
    }
  }
  return { email, name, tags, fields }
}

export function localDay(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
