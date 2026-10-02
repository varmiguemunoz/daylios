import { In, LessThanOrEqual, type DataSource } from 'typeorm'
import { segmentName, type MarketingStatus } from '@shared/marketing'
import { ResendError, splitName, type ResendGateway } from '@shared/resend-gateway'
import { ContactModel } from '../models/contact.model'
import { ContactTagModel, OutboxModel, TagModel, type OutboxJob } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { now } from './fields'
import { onEnqueue } from './outbox'
import { setStatus } from './contact.service'
import type { GatewayProvider } from './resend.provider'

/** Reintentos: 1 min, 5 min, 30 min, 2 h, y luego cada 6 h. */
const BACKOFF_MIN = [1, 5, 30, 120, 360]
const TICK_MS = 60_000
const BATCH = 50

/**
 * Sincronización con el exterior. Cada tick:
 * 1. `pull` (si se configuró): descarga la cola del Worker y la aplica.
 * 2. Vacía la outbox hacia Resend con reintentos.
 * Corre al arrancar, cada minuto, al despertar el Mac y poco después de cada escritura.
 * Nunca hay dos ticks a la vez; un fallo nunca rompe la app.
 */
export class MarketingSync {
  private running: Promise<void> | null = null
  private again = false
  private timer: NodeJS.Timeout | null = null
  private soon: NodeJS.Timeout | null = null
  private lastError: string | null = null
  private lastPullAt: string | null = null
  /** Lo pone hub-sync (tarea 6). */
  pull: (() => Promise<void>) | null = null
  hubConfigured: () => boolean = () => false

  constructor(
    private readonly db: DataSource,
    private readonly gateway: GatewayProvider,
    private readonly onChange: () => void = () => {}
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    onEnqueue(() => this.kick())
    void this.tick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.soon) clearTimeout(this.soon)
  }

  /** Pide un tick pronto (agrupa varias escrituras seguidas). */
  kick(): void {
    if (this.soon) clearTimeout(this.soon)
    this.soon = setTimeout(() => void this.tick(), 1500)
  }

  /** Un tick completo. Si ya hay uno en marcha, se repite al terminar. */
  tick(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      try {
        do {
          this.again = false
          await this.runOnce()
        } while (this.again)
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  async status(): Promise<MarketingStatus> {
    const repo = this.db.getRepository(OutboxModel)
    const pending = await repo.count()
    const failing = await repo.createQueryBuilder('j').where('j.attempts > 0').getCount()
    return {
      resendConfigured: Boolean(this.gateway()),
      hubConfigured: this.hubConfigured(),
      pending,
      failing,
      lastPullAt: this.lastPullAt,
      lastError: this.lastError
    }
  }

  private async runOnce(): Promise<void> {
    let changed = false
    if (this.pull) {
      try {
        await this.pull()
        this.lastPullAt = now()
      } catch (e) {
        this.lastError = `Hub: ${message(e)}`
      }
    }
    const gateway = this.gateway()
    if (gateway) {
      try {
        changed = await this.drain(gateway)
      } catch (e) {
        this.lastError = `Resend: ${message(e)}`
      }
    }
    if (changed) this.onChange()
  }

  /** Procesa los jobs vencidos en orden. Devuelve si algo cambió en la base. */
  private async drain(gateway: ResendGateway): Promise<boolean> {
    const repo = this.db.getRepository(OutboxModel)
    const jobs = await repo.find({
      where: { nextAt: LessThanOrEqual(now()) },
      order: { createdAt: 'ASC' },
      take: BATCH
    })
    let changed = false
    let postponedNow = false
    for (const job of jobs) {
      try {
        if (job.kind === 'contact') await this.syncContact(gateway, job)
        else await this.sendEvent(gateway, job)
        await transactionGuard(this.db, (m) => m.getRepository(OutboxModel).delete({ id: job.id }))
        changed = true
        this.lastError = null
      } catch (e) {
        if (e instanceof Postpone) {
          await repo.update({ id: job.id }, { nextAt: e.until })
          if (e.until <= now()) postponedNow = true
          continue
        }
        await this.fail(job, e)
        changed = true
        if (e instanceof ResendError && e.fatal) break // la key no sirve: no insistir con el resto
      }
    }
    // Lote lleno, o un evento esperaba a un contacto que ya se sincronizó: otra vuelta.
    if (jobs.length === BATCH || (postponedNow && changed)) this.again = true
    return changed
  }

  private async fail(job: OutboxJob, error: unknown): Promise<void> {
    const text = message(error).slice(0, 500)
    this.lastError = `Resend: ${text}`
    const delay = BACKOFF_MIN[Math.min(job.attempts, BACKOFF_MIN.length - 1)] * 60_000
    await transactionGuard(this.db, async (m) => {
      await m
        .getRepository(OutboxModel)
        .update(
          { id: job.id },
          {
            attempts: job.attempts + 1,
            lastError: text,
            nextAt: new Date(Date.now() + delay).toISOString()
          }
        )
      await m.getRepository(ContactModel).update({ id: job.ref }, { syncError: text })
    })
  }

  /**
   * Deja el contacto de Resend igual que el local: datos, suscripción y segments `tag:*`.
   * Los emails anteriores (cambio o borrado) quedan dados de baja en Resend.
   */
  private async syncContact(gateway: ResendGateway, job: OutboxJob): Promise<void> {
    const contact = await this.db.getRepository(ContactModel).findOneBy({ id: job.ref })
    const previous = ((job.payload.previousEmails as string[]) ?? []).filter(
      (e) => e !== contact?.email
    )
    for (const email of previous) {
      if (await gateway.findContact(email))
        await gateway.updateContact(email, { unsubscribed: true })
    }
    if (!contact || contact.status === 'none' || !contact.email) return

    const email = contact.email
    const desired = await this.segmentsFor(gateway, contact.id)
    const names = splitName(contact.name)
    const unsubscribed = contact.status !== 'subscribed'
    const remote = await gateway.findContact(email)
    if (!remote) {
      await gateway.createContact({ email, ...names, unsubscribed, segmentIds: desired })
    } else {
      if (remote.unsubscribed && !unsubscribed && !job.payload.resubscribe) {
        // Se dio de baja en Resend (enlace del email) antes de que llegara el aviso: manda Resend.
        await transactionGuard(this.db, async (m) => {
          const fresh = await m.getRepository(ContactModel).findOneBy({ id: contact.id })
          if (fresh) await setStatus(m, fresh, 'unsubscribed', 'resend')
        })
        return
      }
      await gateway.updateContact(email, { ...names, unsubscribed })
      const current = await gateway.contactSegments(email)
      for (const id of desired)
        if (!current.some((s) => s.id === id)) await gateway.addToSegment(email, id)
      for (const s of current) {
        if (s.name.startsWith('tag:') && !desired.includes(s.id))
          await gateway.removeFromSegment(email, s.id)
      }
    }
    await transactionGuard(this.db, (m) =>
      m.getRepository(ContactModel).update({ id: contact.id }, { syncedAt: now(), syncError: null })
    )
  }

  /** Ids de los segments de los tags del contacto (crea en Resend los que falten). */
  private async segmentsFor(gateway: ResendGateway, contactId: string): Promise<string[]> {
    const links = await this.db.getRepository(ContactTagModel).findBy({ contactId })
    if (!links.length) return []
    const tags = await this.db.getRepository(TagModel).findBy({ id: In(links.map((l) => l.tagId)) })
    const ids: string[] = []
    for (const tag of tags) {
      if (!tag.segmentId) {
        tag.segmentId = await gateway.ensureSegment(segmentName(tag.slug))
        await transactionGuard(this.db, (m) =>
          m.getRepository(TagModel).update({ id: tag.id }, { segmentId: tag.segmentId })
        )
      }
      ids.push(tag.segmentId)
    }
    return ids
  }

  /** Dispara un evento. Espera a que el contacto esté sincronizado; se descarta si ya no está suscrito. */
  private async sendEvent(gateway: ResendGateway, job: OutboxJob): Promise<void> {
    const contact = await this.db.getRepository(ContactModel).findOneBy({ id: job.ref })
    if (!contact || contact.status !== 'subscribed' || !contact.email) return
    const pendingSync = await this.db
      .getRepository(OutboxModel)
      .findOneBy({ kind: 'contact', ref: contact.id })
    if (pendingSync) throw new Postpone(pendingSync.attempts > 0 ? pendingSync.nextAt : now())
    await gateway.sendEvent(
      String(job.payload.event),
      contact.email,
      (job.payload.payload as Record<string, unknown>) ?? {}
    )
  }
}

/** El job aún no puede correr (no es un fallo). */
class Postpone extends Error {
  constructor(readonly until: string) {
    super('postpone')
  }
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
