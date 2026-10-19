import { CapabilityNotSupported, ProviderRuleViolation } from '../../domain/errors'
import type {
  EnrollRequest,
  RemoteSequence,
  RemoteSequenceDetail,
  SequenceEngine,
  SequenceStep
} from '../../ports/sequences'
import type { ApolloHttp } from './http'

interface ApolloCampaign {
  id: string
  name: string
  active?: boolean
  archived?: boolean
  created_at?: string
  num_steps?: number
}

interface ApolloStep {
  id?: string
  type?: string
  position?: number
  wait_time?: number
  wait_mode?: string
}

const WAIT = /^(\d{1,3}) (minute|hour|day|week)s?$/

export function toWait(wait: string): { wait_time: number; wait_mode: 'minute' | 'hour' | 'day' } {
  const match = WAIT.exec(wait.trim().toLowerCase())
  if (!match) return { wait_time: 0, wait_mode: 'day' }
  const amount = Number(match[1])
  if (match[2] === 'week') return { wait_time: amount * 7, wait_mode: 'day' }
  return { wait_time: amount, wait_mode: match[2] as 'minute' | 'hour' | 'day' }
}

export const apolloSequenceUrl = (id: string): string => `https://app.apollo.io/#/sequences/${id}`

const toRemote = (c: ApolloCampaign, steps?: number): RemoteSequence => ({
  id: c.id,
  name: c.name,
  enabled: c.active === true,
  event: null,
  emails: steps ?? c.num_steps ?? 0,
  createdAt: c.created_at ?? '',
  url: apolloSequenceUrl(c.id)
})

const campaignOf = (body: Record<string, unknown>): ApolloCampaign => {
  const c = (body.emailer_campaign ?? body.sequence ?? body) as ApolloCampaign
  if (!c?.id) throw new ProviderRuleViolation('Apollo no devolvió el id de la secuencia.')
  return c
}

export function toSteps(steps: SequenceStep[]): Record<string, unknown>[] {
  return steps.map((step, i) => ({
    type: 'auto_email',
    position: i + 1,
    ...toWait(i === 0 ? '' : step.wait),
    emailer_touches: [
      {
        type: i > 0 && !step.subject.trim() ? 'reply_to_thread' : 'new_thread',
        status: 'approved',
        emailer_template: { subject: step.subject, body_html: step.html }
      }
    ]
  }))
}

export interface ApolloSequenceOptions {
  scheduleId?: string
  footer?: () => string
}

export function apolloSequences(
  http: ApolloHttp,
  options: ApolloSequenceOptions = {}
): SequenceEngine {
  const schedule = async (): Promise<string> => {
    if (options.scheduleId) return options.scheduleId
    const body = await http.request<{ emailer_schedules?: { id: string; default?: boolean }[] }>(
      'GET',
      '/emailer_schedules'
    )
    const list = body.emailer_schedules ?? []
    const chosen = list.find((s) => s.default) ?? list[0]
    if (!chosen)
      throw new ProviderRuleViolation(
        'Crea un horario de envío en Apollo antes de crear secuencias.'
      )
    return chosen.id
  }

  const mailboxes = async (requested?: string[]): Promise<string[]> => {
    if (requested?.length) return requested
    const body = await http.request<{
      email_accounts?: { id: string; active?: boolean; default?: boolean }[]
    }>('GET', '/email_accounts')
    const active = (body.email_accounts ?? []).filter((a) => a.active !== false)
    active.sort((a, b) => Number(b.default === true) - Number(a.default === true))
    if (!active.length)
      throw new ProviderRuleViolation('Conecta al menos un buzón de envío en Apollo.')
    return active.map((a) => a.id)
  }

  const withFooter = (steps: SequenceStep[]): SequenceStep[] => {
    const footer = options.footer?.().trim()
    if (!footer)
      throw new ProviderRuleViolation(
        'Falta el pie de outreach con tu dirección física y cómo darse de baja. Configúralo en Ajustes, Email.'
      )
    const html = `<p style="color:#666;font-size:12px">${footer.replace(/\n/g, '<br>')}</p>`
    return steps.map((s) => ({ ...s, html: `${s.html}\n${html}` }))
  }

  return {
    entryModes: ['enrollment'],
    authoring: true,

    async list() {
      const body = await http.request<{ emailer_campaigns?: ApolloCampaign[] }>(
        'POST',
        '/emailer_campaigns/search',
        { body: { per_page: 100, page: 1 } }
      )
      return (body.emailer_campaigns ?? []).filter((c) => !c.archived).map((c) => toRemote(c))
    },

    async get(id): Promise<RemoteSequenceDetail> {
      const body = await http.request<Record<string, unknown>>(
        'GET',
        `/emailer_campaigns/${encodeURIComponent(id)}`
      )
      const steps = ((body.emailer_steps ?? []) as ApolloStep[])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      return {
        ...toRemote(campaignOf(body), steps.filter((s) => /email/.test(s.type ?? '')).length),
        steps: steps.map((s, i) => ({
          key: s.id ?? `step_${i + 1}`,
          type: s.type ?? 'step',
          wait: s.wait_time ? `${s.wait_time} ${s.wait_mode ?? 'day'}` : null
        }))
      }
    },

    async save(draft) {
      if (draft.entry.mode !== 'enrollment')
        throw new CapabilityNotSupported(
          'Apollo no inicia secuencias por evento. Inscribe contactos.'
        )
      const emailer_steps = toSteps(withFooter(draft.steps))
      if (draft.id) {
        const body = await http.request<Record<string, unknown>>(
          'PUT',
          `/sequences/${encodeURIComponent(draft.id)}`,
          { body: { name: draft.name, emailer_steps } }
        )
        return toRemote(
          campaignOf({ id: draft.id, name: draft.name, ...body }),
          emailer_steps.length
        )
      }
      const body = await http.request<Record<string, unknown>>('POST', '/sequences', {
        body: {
          name: draft.name,
          active: false,
          emailer_schedule_id: await schedule(),
          emailer_steps,
          mark_finished_if_reply: true,
          mark_finished_if_interested: true,
          mark_paused_if_ooo: true
        }
      })
      return toRemote(campaignOf(body), emailer_steps.length)
    },

    async setEnabled(id, enabled) {
      const body = await http.request<Record<string, unknown>>(
        'PUT',
        `/sequences/${encodeURIComponent(id)}`,
        { body: { active: enabled } }
      )
      const campaign = campaignOf({ id, name: '', ...body })
      return toRemote({ ...campaign, active: campaign.active ?? enabled })
    },

    async trigger() {
      throw new CapabilityNotSupported(
        'Apollo no dispara secuencias por evento. Inscribe contactos.'
      )
    },

    async enroll(id, request: EnrollRequest) {
      if (!request.contacts.length) return { accepted: 0, skipped: 0 }
      const senders = await mailboxes(request.mailboxIds)
      const ids: string[] = []
      for (const contact of request.contacts) {
        const body = await http.request<{ contact?: { id?: string }; id?: string }>(
          'POST',
          '/contacts',
          {
            body: {
              email: contact.email,
              first_name: contact.firstName ?? undefined,
              last_name: contact.lastName ?? undefined,
              organization_name: contact.company ?? undefined,
              label_names: request.labels?.length ? request.labels : undefined,
              run_dedupe: true
            }
          }
        )
        const contactId = body.contact?.id ?? body.id
        if (contactId) ids.push(contactId)
      }
      let accepted = 0
      let skipped = request.contacts.length - ids.length
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100)
        const body = await http.request<{
          contacts?: unknown[]
          skipped_contact_ids?: Record<string, unknown>
        }>('POST', `/emailer_campaigns/${encodeURIComponent(id)}/add_contact_ids`, {
          query: {
            emailer_campaign_id: id,
            contact_ids: batch,
            send_email_from_email_account_id: senders.length === 1 ? senders[0] : senders,
            status: request.paused ? 'paused' : 'active'
          }
        })
        const rejected = Object.keys(body.skipped_contact_ids ?? {}).length
        accepted += Array.isArray(body.contacts) ? body.contacts.length : batch.length - rejected
        skipped += rejected
      }
      return { accepted, skipped }
    }
  }
}
