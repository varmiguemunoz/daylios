import {
  withUnsubscribeFooter,
  type SequenceEmailInput,
  type SequenceInput,
  type SequenceSummary
} from '@shared/marketing'
import type {
  AutomationDraft,
  AutomationStepDraft,
  RemoteAutomationDetail,
  ResendGateway
} from '@shared/resend-gateway'
import { config } from '../config'
import { AppError } from './app.error'
import { requiredText } from './fields'
import type { GatewayProvider } from './resend.provider'

const EVENT = /^[a-zA-Z0-9._-]{1,100}$/
/** Formato de espera de Resend ("1 day", "3 hours", "30 minutes", "2 weeks"). */
const WAIT = /^\d{1,3} (minute|hour|day|week)s?$/

export interface SequenceDetail extends SequenceSummary {
  steps: { key: string; type: string; wait: string | null }[]
}

/**
 * Secuencias = Automations de Resend. Corren en Resend (aunque el Mac esté apagado); aquí se
 * listan y Claude puede crear o reescribir una secuencia lineal: evento → [espera] → email → …
 * Resend no deja editar los pasos de una automation activa: hay que pausarla antes.
 */
export class SequenceService {
  constructor(private readonly gateway: GatewayProvider) {}

  async list(): Promise<SequenceSummary[]> {
    const g = this.resend()
    const list = await g.listAutomations()
    const details = await Promise.all(list.map((a) => g.getAutomation(a.id)))
    return details.map(summary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async get(id: unknown): Promise<SequenceDetail> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    const a = await this.resend().getAutomation(id)
    return {
      ...summary(a),
      steps: a.steps.map((s) => ({
        key: s.key,
        type: s.type,
        wait: s.type === 'delay' ? String(s.config.duration ?? '') : null
      }))
    }
  }

  /**
   * Crea (sin `id`) o reescribe una secuencia. Cada email es un template nuevo publicado con el
   * pie de baja. Queda pausada salvo `enabled: true`.
   */
  async save(input: SequenceInput & { id?: string }): Promise<SequenceSummary> {
    const g = this.resend()
    const from = config.from()
    if (!from)
      throw new AppError(
        'invalid',
        'Configura el remitente en Ajustes → Email antes de crear secuencias.'
      )
    const name = requiredText(input.name, 'El nombre de la secuencia', 120)
    const event = requiredText(input.event, 'El evento que la dispara', 100)
    if (!EVENT.test(event)) {
      throw new AppError(
        'invalid',
        'El evento solo admite letras, números, puntos, guiones y guiones bajos.'
      )
    }
    const emails = validEmails(input.emails)

    if (input.id) {
      const current = await g.getAutomation(input.id)
      if (current.status === 'enabled') {
        throw new AppError(
          'invalid',
          'Resend no deja editar una secuencia activa. Páusala primero y vuelve a guardarla.'
        )
      }
    }

    const templates: string[] = []
    for (const [i, email] of emails.entries()) {
      templates.push(
        await g.createTemplate({
          name: `${name} · ${i + 1}`,
          subject: email.subject,
          html: withUnsubscribeFooter(email.html),
          from
        })
      )
    }
    const draft = buildDraft(name, event, emails, templates, input.enabled === true)
    const id = input.id ?? (await g.createAutomation(draft))
    if (input.id) await g.updateAutomation(input.id, draft)
    return summary(await g.getAutomation(id))
  }

  async setStatus(id: unknown, enabled: unknown): Promise<SequenceSummary> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    const g = this.resend()
    await g.updateAutomation(id, { status: enabled === true ? 'enabled' : 'disabled' })
    return summary(await g.getAutomation(id))
  }

  private resend(): ResendGateway {
    const g = this.gateway()
    if (!g) throw new AppError('invalid', 'Falta la API key de Resend (Ajustes → Email).')
    return g
  }
}

function validEmails(value: unknown): Required<SequenceEmailInput>[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new AppError('invalid', 'La secuencia necesita al menos un email.')
  if (value.length > 20)
    throw new AppError('invalid', 'Una secuencia admite como máximo 20 emails.')
  return value.map((raw: Record<string, unknown>, i) => {
    const n = i + 1
    const wait = typeof raw?.wait === 'string' ? raw.wait.trim().toLowerCase() : ''
    if (wait && !WAIT.test(wait)) {
      throw new AppError(
        'invalid',
        `La espera del email ${n} debe ser como "1 day", "3 hours" o "30 minutes".`
      )
    }
    const html = typeof raw?.html === 'string' ? raw.html : ''
    if (!html.trim()) throw new AppError('invalid', `El email ${n} no tiene contenido (html).`)
    if (html.length > 200_000) throw new AppError('invalid', `El email ${n} es demasiado largo.`)
    return { wait, subject: requiredText(raw?.subject, `El asunto del email ${n}`, 200), html }
  })
}

/** trigger → [delay] → send_email → [delay] → send_email … (conexiones por defecto). */
export function buildDraft(
  name: string,
  event: string,
  emails: { wait: string }[],
  templates: string[],
  enabled: boolean
): AutomationDraft {
  const steps: AutomationStepDraft[] = [
    { key: 'start', type: 'trigger', config: { eventName: event } }
  ]
  emails.forEach((email, i) => {
    if (email.wait)
      steps.push({ key: `wait_${i + 1}`, type: 'delay', config: { duration: email.wait } })
    steps.push({
      key: `email_${i + 1}`,
      type: 'send_email',
      config: { template: { id: templates[i] } }
    })
  })
  const connections = steps.slice(1).map((step, i) => ({ from: steps[i].key, to: step.key }))
  return { name, status: enabled ? 'enabled' : 'disabled', steps, connections }
}

function summary(a: RemoteAutomationDetail): SequenceSummary {
  const trigger = a.steps.find((s) => s.type === 'trigger')
  const event = trigger ? (trigger.config.eventName ?? trigger.config.event_name ?? null) : null
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    event: typeof event === 'string' ? event : null,
    emails: a.steps.filter((s) => s.type === 'send_email').length,
    createdAt: a.createdAt,
    url: `https://resend.com/automations/${a.id}`
  }
}
