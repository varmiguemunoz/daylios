import {
  withUnsubscribeFooter,
  type SequenceEmailInput,
  type SequenceInput,
  type SequenceSummary
} from '@shared/marketing'
import type { DeliveryRouter, RemoteSequence, SequenceEngine } from '@shared/email-delivery'
import { config } from '../config'
import { AppError } from './app.error'
import { requiredText } from './fields'
import { delivery, deliveryCall } from './delivery'

const EVENT = /^[a-zA-Z0-9._-]{1,100}$/

const WAIT = /^\d{1,3} (minute|hour|day|week)s?$/

export interface SequenceDetail extends SequenceSummary {
  steps: { key: string; type: string; wait: string | null }[]
}

export class SequenceService {
  constructor(private readonly router: DeliveryRouter) {}

  async list(): Promise<SequenceSummary[]> {
    const list = await this.engine().list()
    return list.map(summary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async get(id: unknown): Promise<SequenceDetail> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    const detail = await this.engine().get(id)
    return { ...summary(detail), steps: detail.steps }
  }

  async save(input: SequenceInput & { id?: string }): Promise<SequenceSummary> {
    const engine = this.engine()
    const provider = delivery(() => this.router.use('marketing'))
    const from = config.from()
    if (!from && provider.policy.sender === 'domain')
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
    const saved = await deliveryCall(
      engine.save({
        id: input.id,
        name,
        from: from || undefined,
        entry: { mode: 'event', event },
        steps: emails.map((email) => ({ ...email, html: withUnsubscribeFooter(email.html) })),
        enabled: input.enabled === true
      })
    )
    return summary(saved)
  }

  async setStatus(id: unknown, enabled: unknown): Promise<SequenceSummary> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    return summary(await this.engine().setEnabled(id, enabled === true))
  }

  private engine(): SequenceEngine {
    return delivery(() => this.router.sequences('marketing'))
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

function summary(a: RemoteSequence): SequenceSummary {
  return {
    id: a.id,
    name: a.name,
    status: a.enabled ? 'enabled' : 'disabled',
    event: a.event,
    emails: a.emails,
    createdAt: a.createdAt,
    url: a.url
  }
}
