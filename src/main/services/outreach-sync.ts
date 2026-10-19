import type { DataSource } from 'typeorm'
import {
  SUPPRESSING_EVENTS,
  normalizeAddress,
  type DeliveryEvent,
  type DeliveryRouter
} from '@shared/email-delivery'
import { localDay } from '@shared/marketing'
import { ContactModel } from '../models/contact.model'
import { transactionGuard } from '../guards/transaction.guard'
import { config, saveOutreachCursor } from '../config'
import { logEvent, setStatus } from './contact.service'
import { insertTaskWithRoom } from './task.service'
import { now } from './fields'

const TICK_MS = 5 * 60_000
const INTERESTED = /meet|question|referral|interes|willing|pregunta|reuni/i
const NOT_INTERESTED = /not|no interes|out of office|left|wrong/i

export const isInterested = (replyClass: unknown): boolean =>
  typeof replyClass === 'string' && INTERESTED.test(replyClass) && !NOT_INTERESTED.test(replyClass)

export class OutreachSync {
  private timer: NodeJS.Timeout | null = null
  private running: Promise<number> | null = null
  lastPollAt: string | null = null
  lastError: string | null = null

  constructor(
    private readonly db: DataSource,
    private readonly router: DeliveryRouter,
    private readonly onChange: () => void = () => {}
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.poll(), TICK_MS)
    void this.poll()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  poll(): Promise<number> {
    if (this.running) return this.running
    this.running = this.run().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async run(): Promise<number> {
    let provider
    try {
      provider = this.router.find('outreach')
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
      return 0
    }
    if (provider?.events?.mode !== 'pull') return 0
    try {
      const { events, cursor } = await provider.events.poll(config.outreachCursor())
      let applied = 0
      for (const event of events) if (await this.apply(event, provider.id)) applied++
      saveOutreachCursor(cursor)
      this.lastPollAt = now()
      this.lastError = null
      if (applied) this.onChange()
      return applied
    } catch (e) {
      this.lastError = `${provider.label}: ${e instanceof Error ? e.message : String(e)}`
      return 0
    }
  }

  private apply(event: DeliveryEvent, provider: string): Promise<boolean> {
    return transactionGuard(this.db, async (m) => {
      const contact = await m
        .getRepository(ContactModel)
        .findOneBy({ email: normalizeAddress(event.email) })
      if (!contact) return false
      if (SUPPRESSING_EVENTS.includes(event.type)) {
        await setStatus(
          m,
          contact,
          event.type as 'unsubscribed' | 'bounced' | 'complained',
          provider
        )
        return true
      }
      if (event.type !== 'replied') return false
      const replyClass = event.detail?.class ?? null
      await logEvent(m, contact.id, 'outreach_reply', {
        class: replyClass,
        sequence: event.detail?.sequenceId ?? null,
        provider
      })
      if (isInterested(replyClass)) {
        await insertTaskWithRoom(m, {
          title: `Responder a ${contact.name || contact.email}`,
          date: localDay(),
          description: `Respondió a la secuencia de outreach (${String(replyClass)}). Contesta hoy.`,
          tags: ['outreach'],
          effort: 'bajo',
          clientId: null,
          prospectId: contact.prospectId ?? null
        })
      }
      return true
    })
  }
}
