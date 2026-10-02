/**
 * Email marketing (mini-GHL): estados de suscripción, tags, fuentes, reglas, secuencias y
 * newsletter. Compartido entre main, preload, renderer, MCP y el Worker `leads-hub`.
 * Solo tipos, contrato y utilidades puras (sin Node ni DOM).
 */

// ---- Contactos ----

/**
 * `none` = contacto de trabajo (nunca recibe marketing). Solo `subscribed` recibe emails.
 * `bounced` y `complained` los marca Resend; no se reactivan solos.
 */
export type ContactStatus = 'none' | 'subscribed' | 'unsubscribed' | 'bounced' | 'complained'
export const CONTACT_STATUSES: ContactStatus[] = [
  'none',
  'subscribed',
  'unsubscribed',
  'bounced',
  'complained'
]

/** Estado de suscripción en palabras (UI y respuestas). */
export const STATUS_LABELS: Record<ContactStatus, string> = {
  none: 'Sin marketing',
  subscribed: 'Suscrito',
  unsubscribed: 'Dado de baja',
  bounced: 'Su email rebotó',
  complained: 'Marcó un email como spam'
}

/** Valores libres que llegan en `fields` de un webhook. */
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
  /** a-z0-9 y guiones. Es la clave: `tag.<slug>` (evento) y `tag:<slug>` (segment). */
  slug: string
  name: string
  /** Segment de Resend (se crea la primera vez que hace falta). */
  segmentId: string | null
  createdAt: string
}

export type TagRef = Pick<Tag, 'slug' | 'name'>

export interface TagSummary extends Tag {
  contacts: number
  subscribed: number
}

// ---- Fuentes (webhooks de entrada) ----

export interface LeadSource {
  id: string
  slug: string
  name: string
  /** Secreto de la URL de entrada. Solo lo ve la app (el Worker guarda su hash). */
  secret: string
  /** Tags extra que se aplican a todo lead de esta fuente (además de `origen-<slug>`). */
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
  /** Pasa a pipeline en la etapa `stage` (id o nombre; vacío = primera abierta). */
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
  /** Slug del tag que la dispara al entrar. */
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
  /** Evento que la dispara (`tag.webinar`, `lead.created`…). */
  event: string | null
  emails: number
  createdAt: string
  url: string
}

export interface SequenceEmailInput {
  /** Espera antes de este email, p. ej. "1 day", "3 hours". Vacío = sin espera. */
  wait?: string
  subject: string
  html: string
}

export interface SequenceInput {
  name: string
  event: string
  emails: SequenceEmailInput[]
  /** Por defecto queda pausada para revisarla en Resend. */
  enabled?: boolean
}

// ---- Newsletter ----

export type NewsletterStatus = 'sending' | 'scheduled' | 'sent' | 'failed'

export interface Newsletter {
  id: string
  /** Día local YYYY-MM-DD (tope: uno por día). */
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
  /** ISO 8601 o lenguaje natural de Resend ("tomorrow at 9am"). Vacío = ahora. */
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
  /** Jobs pendientes hacia Resend. */
  pending: number
  failing: number
  lastPullAt: string | null
  lastError: string | null
}

// ---- Contrato de la ventana (IPC `marketing:*`; los mismos servicios sirven `/marketing/*`) ----

export interface MarketingApi {
  listTags(): Promise<TagSummary[]>
  /** Cambia el nombre visible (el slug no cambia). */
  renameTag(slug: string, name: string): Promise<Tag>
  /** Cola hacia Resend y última descarga del hub. */
  status(): Promise<MarketingStatus>
  /** Sincroniza ahora (hub + cola) y devuelve el estado. */
  syncNow(): Promise<MarketingStatus>
  testResend(): Promise<{ ok: boolean; message: string }>

  listSources(): Promise<LeadSource[]>
  createSource(input: LeadSourceInput): Promise<LeadSource>
  updateSource(slug: string, patch: LeadSourceInput): Promise<LeadSource>
  /** Secreto nuevo: el anterior deja de funcionar. */
  rotateSourceSecret(slug: string): Promise<LeadSource>
  removeSource(slug: string): Promise<void>
  /** Prueba la URL y el token del Worker guardados. */
  testHub(): Promise<{ ok: boolean; message: string }>

  listRules(): Promise<Rule[]>
  createRule(input: RuleInput): Promise<Rule>
  updateRule(id: string, patch: RuleInput): Promise<Rule>
  removeRule(id: string): Promise<void>
  /** Lista completa de ids en el nuevo orden. */
  reorderRules(ids: string[]): Promise<Rule[]>

  /** Automations de Resend (necesita la API key). */
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

/** "Webinar Octubre" → "webinar-octubre". Vacío si no queda nada útil. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Tag que marca por dónde entró un lead. */
export const sourceTag = (sourceSlug: string): string => `origen-${sourceSlug}`

/** Evento de Resend al entrar en un tag (las secuencias se enganchan a él). */
export const tagEvent = (slug: string): string => `tag.${slug}`

/** Nombre del Segment de Resend que corresponde a un tag. */
export const segmentName = (slug: string): string => `tag:${slug}`

export const LEAD_CREATED = 'lead.created'

export const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}'

/** Añade un pie con el enlace de baja si el HTML no lo trae ya. */
export function withUnsubscribeFooter(html: string): string {
  if (html.includes(UNSUBSCRIBE_PLACEHOLDER)) return html
  const footer =
    '<p style="margin-top:32px;font-size:12px;color:#888">' +
    `¿No quieres recibir más emails? <a href="${UNSUBSCRIBE_PLACEHOLDER}">Darse de baja</a>.</p>`
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${footer}</body>`)
    : `${html}\n${footer}`
}

/** Nombre visible de un contacto: el nombre o, si falta, el email. */
export const contactLabel = (c: { name: string | null; email: string | null }): string =>
  c.name || c.email || 'Sin nombre'

/** Lista de tags limpia y sin repetidos (slugs). */
export function cleanTags(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  for (const v of values) {
    const slug = typeof v === 'string' ? slugify(v) : ''
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

/**
 * Valida el payload único de los webhooks. Devuelve el lead limpio o un mensaje de error.
 * `fields` acepta solo valores simples (texto, número, booleano, null), máximo 50 claves.
 */
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

/** Día local YYYY-MM-DD de una fecha. */
export function localDay(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
