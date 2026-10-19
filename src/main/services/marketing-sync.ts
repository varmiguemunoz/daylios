import { In, LessThanOrEqual, type DataSource } from 'typeorm'
import { DELIVERY_ROLES } from '@shared/email-delivery'
import { segmentName, type MarketingStatus } from '@shared/marketing'
import {
  EmailProviderError,
  splitName,
  type AudienceStore,
  type DeliveryRouter,
  type EmailProvider,
  type SequenceEngine
} from '@shared/email-delivery'
import { ContactModel } from '../models/contact.model'
import { ContactTagModel, OutboxModel, TagModel, type OutboxJob } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { now } from './fields'
import { onEnqueue } from './outbox'
import { setStatus } from './contact.service'

const BACKOFF_MIN = [1, 5, 30, 120, 360]
const TICK_MS = 60_000
const BATCH = 50

export class MarketingSync {
  private running: Promise<void> | null = null
  private again = false
  private timer: NodeJS.Timeout | null = null
  private soon: NodeJS.Timeout | null = null
  private lastError: string | null = null
  private lastPullAt: string | null = null

  pull: (() => Promise<void>) | null = null
  hubConfigured: () => boolean = () => false

  constructor(
    private readonly db: DataSource,
    private readonly router: DeliveryRouter,
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

  kick(): void {
    if (this.soon) clearTimeout(this.soon)
    this.soon = setTimeout(() => void this.tick(), 1500)
  }

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
      email: DELIVERY_ROLES.map((role) => this.router.describe(role)),
      resendConfigured: Boolean(this.router.find('marketing')),
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
    const provider = this.router.find('marketing')
    if (provider) {
      try {
        changed = await this.drain(provider)
      } catch (e) {
        this.lastError = `${provider.label}: ${message(e)}`
      }
    }
    if (changed) this.onChange()
  }

  private async drain(provider: EmailProvider): Promise<boolean> {
    const audience = this.router.audience('marketing')
    const engine = this.router.sequences('marketing')
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
        if (job.kind === 'contact') await this.syncContact(audience, job)
        else if (job.kind === 'segment_delete')
          await audience.deleteGroup(String(job.payload.segmentId))
        else await this.sendEvent(engine, job)
        await transactionGuard(this.db, (m) => m.getRepository(OutboxModel).delete({ id: job.id }))
        changed = true
        this.lastError = null
      } catch (e) {
        if (e instanceof Postpone) {
          await repo.update({ id: job.id }, { nextAt: e.until })
          if (e.until <= now()) postponedNow = true
          continue
        }
        await this.fail(job, e, provider.label)
        changed = true
        if (e instanceof EmailProviderError && e.fatal) break
      }
    }
    // Lote lleno, o un evento esperaba a un contacto que ya se sincronizó: otra vuelta.
    if (jobs.length === BATCH || (postponedNow && changed)) this.again = true
    return changed
  }

  private async fail(job: OutboxJob, error: unknown, label: string): Promise<void> {
    const text = message(error).slice(0, 500)
    this.lastError = `${label}: ${text}`
    const delay = BACKOFF_MIN[Math.min(job.attempts, BACKOFF_MIN.length - 1)] * 60_000
    await transactionGuard(this.db, async (m) => {
      await m.getRepository(OutboxModel).update(
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

  private async syncContact(audience: AudienceStore, job: OutboxJob): Promise<void> {
    const contact = await this.db.getRepository(ContactModel).findOneBy({ id: job.ref })
    const previous = ((job.payload.previousEmails as string[]) ?? []).filter(
      (e) => e !== contact?.email
    )
    for (const email of previous) {
      if (await audience.findContact(email))
        await audience.updateContact(email, { unsubscribed: true })
    }
    if (!contact || contact.status === 'none' || !contact.email) return

    const email = contact.email
    const desired = await this.segmentsFor(audience, contact.id)
    const names = splitName(contact.name)
    const unsubscribed = contact.status !== 'subscribed'
    const remote = await audience.findContact(email)
    if (!remote) {
      await audience.createContact({ email, ...names, unsubscribed, groupIds: desired })
    } else {
      if (remote.unsubscribed && !unsubscribed && !job.payload.resubscribe) {
        await transactionGuard(this.db, async (m) => {
          const fresh = await m.getRepository(ContactModel).findOneBy({ id: contact.id })
          if (fresh) await setStatus(m, fresh, 'unsubscribed', 'resend')
        })
        return
      }
      await audience.updateContact(email, { ...names, unsubscribed })
      const current = await audience.groupsOf(email)
      for (const id of desired)
        if (!current.some((s) => s.id === id)) await audience.addToGroup(email, id)
      for (const s of current) {
        if (s.name.startsWith('tag:') && !desired.includes(s.id))
          await audience.removeFromGroup(email, s.id)
      }
    }
    await transactionGuard(this.db, (m) =>
      m.getRepository(ContactModel).update({ id: contact.id }, { syncedAt: now(), syncError: null })
    )
  }

  private async segmentsFor(audience: AudienceStore, contactId: string): Promise<string[]> {
    const links = await this.db.getRepository(ContactTagModel).findBy({ contactId })
    if (!links.length) return []
    const tags = await this.db
      .getRepository(TagModel)
      .findBy({ id: In(links.map((l) => l.tagId)), audience: true })
    const ids: string[] = []
    for (const tag of tags) {
      if (!tag.segmentId) {
        tag.segmentId = await audience.ensureGroup(segmentName(tag.slug))
        await transactionGuard(this.db, (m) =>
          m.getRepository(TagModel).update({ id: tag.id }, { segmentId: tag.segmentId })
        )
      }
      ids.push(tag.segmentId)
    }
    return ids
  }

  private async sendEvent(engine: SequenceEngine, job: OutboxJob): Promise<void> {
    const contact = await this.db.getRepository(ContactModel).findOneBy({ id: job.ref })
    if (!contact || contact.status !== 'subscribed' || !contact.email) return
    const pendingSync = await this.db
      .getRepository(OutboxModel)
      .findOneBy({ kind: 'contact', ref: contact.id })
    if (pendingSync) throw new Postpone(pendingSync.attempts > 0 ? pendingSync.nextAt : now())
    await engine.trigger(
      String(job.payload.event),
      contact.email,
      (job.payload.payload as Record<string, unknown>) ?? {}
    )
  }
}

class Postpone extends Error {
  constructor(readonly until: string) {
    super('postpone')
  }
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
