import { randomUUID } from 'crypto'
import type { ApolloHttp, Query } from '@shared/email-delivery/providers/apollo'
import { apolloError } from '@shared/email-delivery/providers/apollo/errors'

interface Campaign {
  id: string
  name: string
  active: boolean
  archived: boolean
  created_at: string
  emailer_steps: Record<string, unknown>[]
}

type Step = Record<string, unknown> & {
  id?: string
  emailer_touches?: (Record<string, unknown> & {
    id?: string
    emailer_template?: Record<string, unknown> & { id?: string }
  })[]
}

let counter = 0
const newId = (): string => (++counter).toString(16).padStart(24, 'a')

export class FakeApollo implements ApolloHttp {
  calls: { method: string; path: string; query?: Query; body?: unknown }[] = []
  accounts = [
    { id: 'mb1', email: 'ali@ventas.com', active: true, default: false },
    { id: 'mb2', email: 'ali@outreach.com', active: true, default: true }
  ]
  campaigns = new Map<string, Campaign>()
  contacts = new Map<string, { id: string; email: string; label_names?: string[] }>()
  enrolled: { sequence: string; contactIds: string[]; senders: unknown; status: unknown }[] = []
  messages: Record<string, unknown>[] = []
  failStatus: number | null = null

  async request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown } = {}
  ): Promise<T> {
    this.calls.push({ method, path, ...init })
    if (this.failStatus) {
      const status = this.failStatus
      this.failStatus = null
      throw apolloError(`Fallo simulado ${status}`, 'http_error', status)
    }
    const body = (init.body ?? {}) as Record<string, unknown>
    const q = init.query ?? {}
    let m: RegExpMatchArray | null

    if (method === 'GET' && path === '/email_accounts')
      return { email_accounts: this.accounts } as T
    if (method === 'GET' && path === '/emailer_schedules')
      return { emailer_schedules: [{ id: 'sch1', default: true }] } as T
    if (method === 'POST' && path === '/emailer_campaigns/search')
      return { emailer_campaigns: [...this.campaigns.values()].map(this.summary) } as T
    if (method === 'POST' && path === '/sequences') {
      const c: Campaign = {
        id: randomUUID().replace(/-/g, '').slice(0, 24),
        name: String(body.name),
        active: body.active === true,
        archived: false,
        created_at: new Date().toISOString(),
        emailer_steps: this.withIds((body.emailer_steps as Step[]) ?? [])
      }
      this.campaigns.set(c.id, c)
      return { emailer_campaign: this.summary(c) } as T
    }
    if ((m = path.match(/^\/sequences\/([^/]+)$/)) && method === 'PUT') {
      const c = this.campaigns.get(m[1])
      if (!c) throw apolloError('No existe', 'http_error', 404)
      if (typeof body.active === 'boolean') c.active = body.active
      if (typeof body.name === 'string') c.name = body.name
      if (Array.isArray(body.emailer_steps))
        c.emailer_steps = this.withIds(body.emailer_steps as Step[])
      return { emailer_campaign: this.summary(c) } as T
    }
    if ((m = path.match(/^\/emailer_campaigns\/([^/]+)$/)) && method === 'GET') {
      const c = this.campaigns.get(m[1])
      if (!c) throw apolloError('No existe', 'http_error', 404)
      const steps = c.emailer_steps as Step[]
      return {
        emailer_campaign: this.summary(c),
        emailer_steps: steps.map((step) => {
          const copy = { ...step }
          delete copy.emailer_touches
          return copy
        }),
        emailer_touches: steps.flatMap((step) =>
          (step.emailer_touches ?? []).map(({ emailer_template, ...touch }) => ({
            ...touch,
            emailer_step_id: step.id,
            emailer_template_id: emailer_template?.id
          }))
        ),
        emailer_templates: steps.flatMap((step) =>
          (step.emailer_touches ?? []).map((t) => ({
            ...t.emailer_template,
            body_html: `<html><head></head><body>${String(t.emailer_template?.body_html ?? '')}</body></html>`
          }))
        )
      } as T
    }
    if ((m = path.match(/^\/emailer_campaigns\/([^/]+)\/archive$/)) && method === 'POST') {
      const c = this.campaigns.get(m[1])
      if (!c) throw apolloError('No existe', 'http_error', 404)
      c.archived = true
      c.active = false
      return { emailer_campaign: this.summary(c) } as T
    }
    if (method === 'POST' && path === '/contacts') {
      const email = String(body.email).toLowerCase()
      const existing = this.contacts.get(email)
      const contact = existing ?? { id: `c_${this.contacts.size + 1}`, email }
      contact.label_names = body.label_names as string[] | undefined
      this.contacts.set(email, contact)
      return { contact } as T
    }
    if ((m = path.match(/^\/emailer_campaigns\/([^/]+)\/add_contact_ids$/)) && method === 'POST') {
      const contactIds = q.contact_ids as string[]
      this.enrolled.push({
        sequence: m[1],
        contactIds,
        senders: q.send_email_from_email_account_id,
        status: q.status
      })
      return { contacts: contactIds.map((id) => ({ id })), skipped_contact_ids: {} } as T
    }
    if (method === 'GET' && path === '/emailer_messages/search') {
      const page = Number(q.page ?? 1)
      return { emailer_messages: page === 1 ? this.messages : [] } as T
    }
    throw apolloError(`Ruta no simulada ${method} ${path}`, 'http_error', 404)
  }

  private withIds(steps: Step[]): Step[] {
    return steps.map((step) => ({
      ...step,
      id: step.id ?? newId(),
      emailer_touches: (step.emailer_touches ?? []).map((touch) => ({
        ...touch,
        id: touch.id ?? newId(),
        emailer_template: { ...touch.emailer_template, id: touch.emailer_template?.id ?? newId() }
      }))
    }))
  }

  private summary = (c: Campaign): Record<string, unknown> => ({
    id: c.id,
    name: c.name,
    active: c.active,
    archived: c.archived,
    created_at: c.created_at,
    num_steps: c.emailer_steps.length
  })
}
