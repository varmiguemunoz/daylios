import { In, MoreThanOrEqual, type DataSource } from 'typeorm'
import {
  canReceive,
  splitName,
  type DeliveryRouter,
  type RemoteSequence,
  type RemoteSequenceDetail,
  type SequenceEngine
} from '@shared/email-delivery'
import type {
  OutreachEnrollInput,
  OutreachEnrollResult,
  OutreachSequenceInput,
  OutreachStatus
} from '@shared/marketing'
import { ContactModel } from '../models/contact.model'
import { ContactEventModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { config } from '../config'
import { AppError } from './app.error'
import { logEvent } from './contact.service'
import { delivery, deliveryCall } from './delivery'
import { requiredText } from './fields'

const WAIT = /^\d{1,3} (minute|hour|day|week)s?$/
const MAX_EMAILS = 10
const MAX_BATCH = 500

const startOfToday = (): string => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

export class OutreachService {
  constructor(
    private readonly db: DataSource,
    private readonly router: DeliveryRouter
  ) {}

  list(): Promise<RemoteSequence[]> {
    return deliveryCall(this.engine().list())
  }

  get(id: unknown): Promise<RemoteSequenceDetail> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    return deliveryCall(this.engine().get(id))
  }

  async save(input: OutreachSequenceInput): Promise<RemoteSequence> {
    const engine = this.engine()
    if (!config.outreachFooter().trim())
      throw new AppError(
        'invalid',
        'Falta el pie de outreach con tu dirección física y cómo darse de baja (Ajustes, Email).'
      )
    const name = requiredText(input?.name, 'El nombre de la secuencia', 120)
    const steps = validSteps(input?.emails)
    return deliveryCall(
      engine.save({
        id: typeof input.id === 'string' && input.id ? input.id : undefined,
        name,
        entry: { mode: 'enrollment' },
        steps,
        enabled: false
      })
    )
  }

  async setEnabled(id: unknown, enabled: unknown, confirm: unknown): Promise<RemoteSequence> {
    if (typeof id !== 'string' || !id) throw new AppError('invalid', 'Falta el id de la secuencia.')
    if (enabled === true && confirm !== true)
      throw new AppError(
        'invalid',
        'Activar la secuencia envía correos reales desde tus buzones. Repite con confirm: true.'
      )
    return deliveryCall(this.engine().setEnabled(id, enabled === true))
  }

  async enroll(input: OutreachEnrollInput): Promise<OutreachEnrollResult> {
    const engine = this.engine()
    const provider = delivery(() => this.router.use('outreach'))
    const sequenceId = requiredText(input?.sequenceId, 'La secuencia', 100)
    const ids = Array.isArray(input?.contactIds)
      ? [...new Set(input.contactIds.filter((v): v is string => typeof v === 'string'))]
      : []
    if (!ids.length) throw new AppError('invalid', 'Indica al menos un contacto.')
    if (ids.length > MAX_BATCH)
      throw new AppError('invalid', `Máximo ${MAX_BATCH} contactos por inscripción.`)

    const found = await this.db.getRepository(ContactModel).findBy({ id: In(ids) })
    const contacts = ids.flatMap((id) => found.filter((c) => c.id === id))
    const skipped: { id: string; reason: string }[] = ids
      .filter((id) => !contacts.some((c) => c.id === id))
      .map((id) => ({ id, reason: 'No existe ese contacto.' }))
    const eligible = contacts.filter((c) => {
      const check = canReceive('outreach', c)
      if (!check.ok) skipped.push({ id: c.id, reason: check.reason })
      return check.ok
    })

    const remaining = Math.max(0, config.outreachDailyCap() - (await this.sentToday()))
    const now = eligible.slice(0, remaining)
    const deferred = eligible.slice(remaining).map((c) => c.id)
    const labels = Array.isArray(input.labels)
      ? input.labels.filter((l): l is string => typeof l === 'string' && Boolean(l.trim()))
      : []

    const result = now.length
      ? await deliveryCall(
          engine.enroll(sequenceId, {
            contacts: now.map((c) => ({ email: c.email as string, ...splitName(c.name) })),
            labels
          })
        )
      : { accepted: 0, skipped: 0 }

    await transactionGuard(this.db, async (m) => {
      for (const c of now)
        await logEvent(m, c.id, 'outreach_enrolled', {
          sequence: sequenceId,
          provider: provider.id
        })
      for (const s of skipped)
        if (contacts.some((c) => c.id === s.id))
          await logEvent(m, s.id, 'outreach_skipped', { sequence: sequenceId, reason: s.reason })
    })

    return {
      enrolled: result.accepted,
      rejectedByProvider: result.skipped,
      skipped,
      deferred,
      remainingToday: Math.max(0, remaining - now.length)
    }
  }

  async status(): Promise<OutreachStatus> {
    const state = this.router.describe('outreach')
    const sentToday = await this.sentToday()
    return {
      ...state,
      dailyCap: config.outreachDailyCap(),
      sentToday,
      remainingToday: Math.max(0, config.outreachDailyCap() - sentToday),
      hasFooter: Boolean(config.outreachFooter().trim()),
      cursor: config.outreachCursor()
    }
  }

  private sentToday(): Promise<number> {
    return this.db
      .getRepository(ContactEventModel)
      .countBy({ type: 'outreach_enrolled', createdAt: MoreThanOrEqual(startOfToday()) })
  }

  private engine(): SequenceEngine {
    return delivery(() => this.router.sequences('outreach'))
  }
}

function validSteps(value: unknown): { wait: string; subject: string; html: string }[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new AppError('invalid', 'La secuencia necesita al menos un email.')
  if (value.length > MAX_EMAILS)
    throw new AppError(
      'invalid',
      `Una secuencia de outreach admite como máximo ${MAX_EMAILS} emails.`
    )
  return value.map((raw: Record<string, unknown>, i) => {
    const n = i + 1
    const wait = typeof raw?.wait === 'string' ? raw.wait.trim().toLowerCase() : ''
    if (wait && !WAIT.test(wait))
      throw new AppError('invalid', `La espera del email ${n} debe ser como "3 days" o "1 week".`)
    if (i > 0 && !wait)
      throw new AppError('invalid', `El email ${n} necesita una espera, por ejemplo "3 days".`)
    const html = typeof raw?.html === 'string' ? raw.html : ''
    if (!html.trim()) throw new AppError('invalid', `El email ${n} no tiene contenido (html).`)
    if (html.length > 50_000) throw new AppError('invalid', `El email ${n} es demasiado largo.`)
    const subject = typeof raw?.subject === 'string' ? raw.subject.trim().slice(0, 200) : ''
    if (i === 0 && !subject) throw new AppError('invalid', 'El primer email necesita asunto.')
    return { wait, subject, html }
  })
}
