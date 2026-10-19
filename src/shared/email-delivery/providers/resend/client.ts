import { Resend } from 'resend'
import type { ResendClient, WebhookVerifier } from './api'
import { resendError } from './errors'

type Result<T> = {
  data: T | null
  error: { message: string; name?: string; statusCode?: number | null } | null
}

export const RESEND_MIN_INTERVAL_MS = 110

export function createResendClient(apiKey: string): ResendClient {
  const resend = new Resend(apiKey)
  let last = 0
  let chain: Promise<unknown> = Promise.resolve()

  const call = <T>(fn: () => PromiseLike<Result<T>>, allowNotFound = false): Promise<T | null> => {
    const run = async (): Promise<T | null> => {
      const wait = last + RESEND_MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      last = Date.now()
      const { data, error } = await fn()
      if (error) {
        if (allowNotFound && (error.name === 'not_found' || error.statusCode === 404)) return null
        throw resendError(error.message, error.name ?? 'unknown', error.statusCode ?? null)
      }
      return data
    }
    const result = chain.then(run, run)
    chain = result.catch(() => undefined)
    return result
  }
  const must = async <T>(fn: () => PromiseLike<Result<T>>): Promise<T> => (await call(fn)) as T

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

    async deleteSegment(id) {
      await call(() => resend.segments.remove(id), true)
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

export function createResendWebhookVerifier(secret: string, apiKey?: string): WebhookVerifier {
  const resend = new Resend(apiKey || 're_unused')
  return (payload, headers) =>
    resend.webhooks.verify({
      payload,
      headers: {
        id: headers.get('svix-id') ?? '',
        timestamp: headers.get('svix-timestamp') ?? '',
        signature: headers.get('svix-signature') ?? ''
      },
      webhookSecret: secret
    })
}
