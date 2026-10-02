import { Resend } from 'resend'

/**
 * Puerta a Resend. La usan la app (main) y el Worker `leads-hub`.
 * Es una interfaz para poder usar un fake en los tests; `createResendGateway` es la real.
 * Todas las operaciones lanzan `ResendError` si Resend responde con error.
 */
export interface ResendGateway {
  /** Comprueba que la API key funciona. */
  test(): Promise<void>
  findContact(email: string): Promise<RemoteContact | null>
  createContact(input: {
    email: string
    firstName?: string | null
    lastName?: string | null
    unsubscribed: boolean
    segmentIds?: string[]
  }): Promise<string>
  updateContact(
    email: string,
    patch: { firstName?: string | null; lastName?: string | null; unsubscribed?: boolean }
  ): Promise<void>
  /** Segments del contacto (todos, no solo los `tag:*`). */
  contactSegments(email: string): Promise<{ id: string; name: string }[]>
  addToSegment(email: string, segmentId: string): Promise<void>
  removeFromSegment(email: string, segmentId: string): Promise<void>
  /** Devuelve el id del segment con ese nombre; lo crea si no existe. */
  ensureSegment(name: string): Promise<string>
  sendEvent(event: string, email: string, payload?: Record<string, unknown>): Promise<void>
  sendEmail(input: {
    from: string
    to: string
    replyTo?: string
    subject: string
    html: string
  }): Promise<string>
  /** Crea y envía (o programa) un broadcast a un segment. */
  sendBroadcast(input: {
    segmentId: string
    from: string
    replyTo?: string
    subject: string
    html: string
    name?: string
    scheduledAt?: string
  }): Promise<string>
  listAutomations(): Promise<RemoteAutomation[]>
  getAutomation(id: string): Promise<RemoteAutomationDetail>
  createAutomation(input: AutomationDraft): Promise<string>
  updateAutomation(id: string, input: Partial<AutomationDraft>): Promise<void>
  /** Crea un template y lo publica. Devuelve su id. */
  createTemplate(input: {
    name: string
    subject: string
    html: string
    from?: string
  }): Promise<string>
}

export interface RemoteContact {
  id: string
  email: string
  unsubscribed: boolean
}

export interface RemoteAutomation {
  id: string
  name: string
  status: 'enabled' | 'disabled'
  createdAt: string
}

export interface AutomationStepDraft {
  key: string
  type: 'trigger' | 'delay' | 'send_email'
  config: Record<string, unknown>
}

export interface AutomationDraft {
  name: string
  status: 'enabled' | 'disabled'
  steps: AutomationStepDraft[]
  connections: { from: string; to: string }[]
}

export interface RemoteAutomationDetail extends RemoteAutomation {
  steps: { key: string; type: string; config: Record<string, unknown> }[]
  connections: { from: string; to: string }[]
}

export class ResendError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = 'ResendError'
  }

  /** La key no sirve: no tiene sentido seguir intentando hasta que cambie. */
  get fatal(): boolean {
    return ['missing_api_key', 'invalid_api_key', 'restricted_api_key'].includes(this.code)
  }
}

type Result<T> = {
  data: T | null
  error: { message: string; name?: string; statusCode?: number | null } | null
}

/** ~9 peticiones/s: Resend admite 10/s por equipo y no hay ráfagas. */
const MIN_INTERVAL_MS = 110

/** Separa "Ana María López" en nombre ("Ana") y apellidos ("María López"). */
export function splitName(name: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: null, lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null }
}

export function createResendGateway(apiKey: string): ResendGateway {
  const resend = new Resend(apiKey)
  let last = 0
  let chain: Promise<unknown> = Promise.resolve()

  /** Serializa y espacia las llamadas; convierte `{ error }` en excepción. */
  const call = <T>(fn: () => PromiseLike<Result<T>>, allowNotFound = false): Promise<T | null> => {
    const run = async (): Promise<T | null> => {
      const wait = last + MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      last = Date.now()
      const { data, error } = await fn()
      if (error) {
        if (allowNotFound && (error.name === 'not_found' || error.statusCode === 404)) return null
        throw new ResendError(error.message, error.name ?? 'unknown', error.statusCode ?? null)
      }
      return data
    }
    const result = chain.then(run, run)
    chain = result.catch(() => undefined)
    return result
  }
  const must = async <T>(fn: () => PromiseLike<Result<T>>): Promise<T> => (await call(fn)) as T

  /** Recorre una lista paginada por cursor (`after` = id del último). */
  const all = async <T extends { id: string }>(
    page: (after?: string) => Promise<Result<{ data: T[]; has_more: boolean }>>
  ): Promise<T[]> => {
    const out: T[] = []
    let after: string | undefined
    for (let i = 0; i < 50; i++) {
      const res = await must(() => page(after))
      out.push(...res.data)
      if (!res.has_more || !res.data.length) break
      after = res.data[res.data.length - 1].id
    }
    return out
  }

  return {
    async test() {
      await must(() => resend.segments.list({ limit: 1 }))
    },

    async findContact(email) {
      const c = await call(() => resend.contacts.get({ email }), true)
      return c ? { id: c.id, email: c.email, unsubscribed: c.unsubscribed } : null
    },

    async createContact({ email, firstName, lastName, unsubscribed, segmentIds }) {
      const res = await must(() =>
        resend.contacts.create({
          email,
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          unsubscribed,
          segments: segmentIds?.map((id) => ({ id }))
        })
      )
      return res.id
    },

    async updateContact(email, patch) {
      await must(() => resend.contacts.update({ email, ...patch }))
    },

    async contactSegments(email) {
      const list = await all((after) =>
        resend.contacts.segments.list(after ? { email, limit: 100, after } : { email, limit: 100 })
      )
      return list.map((s) => ({ id: s.id, name: s.name }))
    },

    async addToSegment(email, segmentId) {
      await must(() => resend.contacts.segments.add({ email, segmentId }))
    },

    async removeFromSegment(email, segmentId) {
      await call(() => resend.contacts.segments.remove({ email, segmentId }), true)
    },

    async ensureSegment(name) {
      const existing = (
        await all((after) => resend.segments.list(after ? { limit: 100, after } : { limit: 100 }))
      ).find((s) => s.name === name)
      if (existing) return existing.id
      return (await must(() => resend.segments.create({ name }))).id
    },

    async sendEvent(event, email, payload) {
      await must(() => resend.events.send({ event, email, payload }))
    },

    async sendEmail({ from, to, replyTo, subject, html }) {
      return (await must(() => resend.emails.send({ from, to, replyTo, subject, html }))).id
    },

    async sendBroadcast({ segmentId, from, replyTo, subject, html, name, scheduledAt }) {
      const res = await must(() =>
        resend.broadcasts.create({
          segmentId,
          from,
          replyTo,
          subject,
          html,
          name,
          send: true,
          scheduledAt
        } as Parameters<typeof resend.broadcasts.create>[0])
      )
      return res.id
    },

    async listAutomations() {
      const list = await all((after) =>
        resend.automations.list(after ? { limit: 100, after } : { limit: 100 })
      )
      return list.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        createdAt: a.created_at
      }))
    },

    async getAutomation(id) {
      const a = await must(() => resend.automations.get(id))
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        createdAt: a.created_at,
        steps: a.steps.map((s) => ({ key: s.key, type: s.type, config: s.config })),
        connections: a.connections.map((c) => ({ from: c.from, to: c.to }))
      }
    },

    async createAutomation(input) {
      const res = await must(() =>
        resend.automations.create(
          input as unknown as Parameters<typeof resend.automations.create>[0]
        )
      )
      return res.id
    },

    async updateAutomation(id, input) {
      await must(() =>
        resend.automations.update(
          id,
          input as unknown as Parameters<typeof resend.automations.update>[1]
        )
      )
    },

    async createTemplate({ name, subject, html, from }) {
      const created = await must(() => resend.templates.create({ name, subject, html, from }))
      await must(() => resend.templates.publish(created.id))
      return created.id
    }
  }
}
