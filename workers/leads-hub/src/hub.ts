import { runRules } from '../../../src/shared/automation'
import {
  LEAD_CREATED,
  cleanTags,
  normalizeEmail,
  parseLeadPayload,
  segmentName,
  sourceTag,
  tagEvent
} from '../../../src/shared/marketing'
import { splitName, type ResendGateway } from '../../../src/shared/resend-gateway'
import type {
  HubConfig,
  HubHealth,
  HubItem,
  HubLeadItem,
  HubResendResult,
  HubStatus
} from '../../../src/shared/hub'
import type { HubStore } from './store'

/**
 * Lógica del Worker `leads-hub`, sin nada de Cloudflare (se prueba con un store en memoria).
 *
 * - `POST /in/:source`  lead de un formulario / Zapier / Make (secreto por fuente).
 * - `POST /resend/webhook`  bajas, rebotes y quejas desde Resend (firma svix).
 * - `/admin/*`  la app: salud, cola, confirmación y config (token de administración).
 */
export interface HubDeps {
  store: HubStore
  /** null = sin RESEND_API_KEY: solo se encola (la app sincroniza después). */
  gateway: ResendGateway | null
  adminToken: string
  /** Verifica la firma de un webhook de Resend y devuelve el evento, o lanza. null = no configurado. */
  verifyWebhook: ((payload: string, headers: Headers) => unknown) | null
  now?: () => Date
  newId?: () => string
}

export const MAX_BODY = 64 * 1024

export async function handle(request: Request, deps: HubDeps): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  try {
    const lead = path.match(/^\/in\/([a-z0-9-]{1,60})$/)
    if (lead) {
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
      if (request.method !== 'POST') return cors(json({ error: 'Usa POST.' }, 405))
      return cors(await ingest(request, url, lead[1], deps))
    }
    if (path === '/resend/webhook' && request.method === 'POST')
      return await resendWebhook(request, deps)
    if (path.startsWith('/admin/')) return await admin(request, url, path, deps)
    if (path === '/') return json({ ok: true, service: 'leads-hub' })
    return json({ error: 'No existe.' }, 404)
  } catch (error) {
    console.error(error)
    return json({ error: 'Error interno.' }, 500)
  }
}

// ---- Leads ----

async function ingest(request: Request, url: URL, slug: string, deps: HubDeps): Promise<Response> {
  const config = await deps.store.getConfig()
  const source = config.sources.find((s) => s.slug === slug)
  if (!source) return json({ error: 'Fuente desconocida.' }, 404)

  const auth = request.headers.get('authorization') ?? ''
  const secret = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : (url.searchParams.get('key') ?? '')
  if (!secret || !safeEqual(await sha256(secret), source.secretHash)) {
    return json({ error: 'Secreto inválido.' }, 401)
  }

  const body = await readBody(request)
  if (body === null)
    return json({ error: `El cuerpo no puede pasar de ${MAX_BODY / 1024} KB.` }, 413)
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json({ error: 'El cuerpo debe ser JSON.' }, 400)
  }
  const lead = parseLeadPayload(parsed)
  if ('error' in lead) return json({ error: lead.error }, 400)

  const incoming = cleanTags([sourceTag(slug), ...source.defaultTags, ...lead.tags])
  const item = await toResend(lead, incoming, config, deps)
  const queued: HubLeadItem = {
    id: deps.newId?.() ?? crypto.randomUUID(),
    kind: 'lead',
    receivedAt: (deps.now?.() ?? new Date()).toISOString(),
    source: slug,
    lead,
    ...item
  }
  await deps.store.enqueue(queued)
  return json({ ok: true, id: queued.id }, 202)
}

/**
 * Escribe el lead en Resend: contacto, segments de sus tags y eventos (si no está de baja).
 * Si Resend falla, devuelve `ok: false`; el lead se encola igual y la app termina el trabajo.
 */
async function toResend(
  lead: { email: string; name: string | null },
  incoming: string[],
  config: HubConfig,
  deps: HubDeps
): Promise<Omit<HubLeadItem, 'id' | 'kind' | 'receivedAt' | 'source' | 'lead'>> {
  const segments: Record<string, string> = {}
  const result: HubResendResult = {
    ok: false,
    error: null,
    created: false,
    unsubscribed: false,
    segments
  }
  const bySegment = new Map(Object.entries(config.segments).map(([slug, id]) => [id, slug]))
  let outcome = runRules(config.rules, [], incoming)
  const g = deps.gateway
  if (!g) {
    result.error = 'El hub no tiene RESEND_API_KEY.'
    return { ...pick(outcome), resend: result }
  }

  try {
    const remote = await g.findContact(lead.email)
    let current: string[] = []
    if (remote) {
      current = (await g.contactSegments(lead.email))
        .map((s) => bySegment.get(s.id) ?? (s.name.startsWith('tag:') ? s.name.slice(4) : null))
        .filter((s): s is string => Boolean(s))
      outcome = runRules(config.rules, current, incoming)
    } else {
      await g.createContact({ email: lead.email, ...splitName(lead.name), unsubscribed: false })
      result.created = true
    }
    result.unsubscribed = remote?.unsubscribed ?? false

    for (const slug of outcome.added) {
      const id = config.segments[slug] ?? (await g.ensureSegment(segmentName(slug)))
      segments[slug] = id
      await g.addToSegment(lead.email, id)
    }
    for (const slug of outcome.removed) {
      const id = config.segments[slug]
      if (id) await g.removeFromSegment(lead.email, id)
    }
    await deps.store.mergeSegments(segments)

    if (!result.unsubscribed) {
      if (result.created) await g.sendEvent(LEAD_CREATED, lead.email, { source: incoming[0] })
      for (const slug of outcome.added) await g.sendEvent(tagEvent(slug), lead.email)
      for (const event of outcome.events) await g.sendEvent(event, lead.email)
    }
    result.ok = true
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  return { ...pick(outcome), resend: result }
}

const pick = (
  o: ReturnType<typeof runRules>
): Pick<HubLeadItem, 'added' | 'removed' | 'events' | 'promote'> => ({
  added: o.added,
  removed: o.removed,
  events: o.events,
  promote: o.promote
})

// ---- Webhooks de Resend ----

async function resendWebhook(request: Request, deps: HubDeps): Promise<Response> {
  if (!deps.verifyWebhook) return json({ error: 'Webhook no configurado.' }, 503)
  const body = await readBody(request)
  if (body === null) return json({ error: 'Demasiado grande.' }, 413)

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = deps.verifyWebhook(body, request.headers) as typeof event
  } catch {
    return json({ error: 'Firma inválida.' }, 401)
  }

  const statuses = toStatuses(event)
  for (const { email, status } of statuses) {
    const item: HubItem = {
      id: deps.newId?.() ?? crypto.randomUUID(),
      kind: 'status',
      receivedAt: (deps.now?.() ?? new Date()).toISOString(),
      email,
      status,
      event: String(event.type)
    }
    await deps.store.enqueue(item)
  }
  return json({ ok: true, queued: statuses.length })
}

/** Traduce un webhook de Resend a cambios de estado. Los demás tipos se ignoran. */
export function toStatuses(event: { type?: string; data?: Record<string, unknown> }): {
  email: string
  status: HubStatus
}[] {
  const d = event.data ?? {}
  const emails = (value: unknown): string[] =>
    (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === 'string')
      .map(normalizeEmail)

  if (event.type === 'contact.updated' && d.unsubscribed === true) {
    return emails(d.email).map((email) => ({ email, status: 'unsubscribed' }))
  }
  if (event.type === 'email.bounced') {
    // Solo los rebotes permanentes: uno temporal (buzón lleno) no invalida el email.
    const bounce = (d.bounce ?? {}) as { type?: string }
    if (bounce.type && !/permanent/i.test(bounce.type)) return []
    return emails(d.to).map((email) => ({ email, status: 'bounced' }))
  }
  if (event.type === 'email.complained')
    return emails(d.to).map((email) => ({ email, status: 'complained' }))
  return []
}

// ---- Admin (la app) ----

async function admin(request: Request, url: URL, path: string, deps: HubDeps): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (
    !deps.adminToken ||
    !token ||
    !safeEqual(await sha256(token), await sha256(deps.adminToken))
  ) {
    return json({ error: 'No autorizado.' }, 401)
  }

  if (path === '/admin/health' && request.method === 'GET') {
    const config = await deps.store.getConfig()
    const health: HubHealth = {
      ok: true,
      sources: config.sources.length,
      rules: config.rules.length,
      queued: await deps.store.count(),
      resend: Boolean(deps.gateway),
      webhooks: Boolean(deps.verifyWebhook)
    }
    return json(health)
  }
  if (path === '/admin/inbox' && request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500)
    return json({ items: await deps.store.list(limit) })
  }
  if (path === '/admin/ack' && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : null
    if (!ids) return json({ error: 'Envía { ids: string[] }.' }, 400)
    return json({ ok: true, removed: await deps.store.ack(ids.slice(0, 1000)) })
  }
  if (path === '/admin/config' && request.method === 'GET')
    return json(await deps.store.getConfig())
  if (path === '/admin/config' && request.method === 'PUT') {
    const body = await readBody(request, 512 * 1024)
    const config = body ? (JSON.parse(body) as Partial<HubConfig>) : null
    if (!config || !Array.isArray(config.sources) || !Array.isArray(config.rules)) {
      return json({ error: 'Config inválida.' }, 400)
    }
    return json(
      await deps.store.putConfig({
        sources: config.sources,
        rules: config.rules,
        segments: config.segments ?? {}
      })
    )
  }
  return json({ error: 'No existe.' }, 404)
}

// ---- Utilidades ----

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })

/** Formularios web que llaman directo desde el navegador. */
function cors(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-allow-methods', 'POST, OPTIONS')
  headers.set('access-control-allow-headers', 'authorization, content-type')
  return new Response(response.body, { status: response.status, headers })
}

/** Lee el cuerpo con límite. null = demasiado grande. */
async function readBody(request: Request, max = MAX_BODY): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > max) return null
  const text = await request.text()
  return new TextEncoder().encode(text).length > max ? null : text
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparación en tiempo constante (mismo largo: hashes hex). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
