import { randomUUID } from 'crypto'
import { In, IsNull, LessThan, LessThanOrEqual, type DataSource } from 'typeorm'
import {
  nextRun,
  RETENTION_DAYS,
  triggerSpec,
  type AutomationRun,
  type StoredEvent,
  type TriggerDef
} from '@shared/automations'
import { transactionGuard } from '../guards/transaction.guard'
import {
  AutomationEventModel,
  AutomationRunModel,
  RunStepModel,
  TriggerLogModel
} from '../models/automation.model'
import { AutomationCache } from './cache'
import { enroll } from './enroll'
import { onAutomationEvent } from './events'
import type { Handlers, Ports } from './ports'
import { Runner } from './runner'

const TICK_MS = 15_000
const EVENTS_PER_TICK = 200
const RUNS_PER_TICK = 50
const LATE_MS = 5 * 60_000
const DAY_MS = 24 * 60 * 60_000
const ALERT_MS = DAY_MS

const MANUAL: TriggerDef = { id: 'manual', type: 'manual', params: {}, conditions: [] }

function manualTrigger(event: StoredEvent, automationId: string): TriggerDef | null {
  return event.type === 'manual' && event.payload.automationId === automationId ? MANUAL : null
}

export interface EngineDeps {
  handlers: Handlers
  ports: Ports
  onRunChange?(run: AutomationRun): void
  onAlert?(automationId: string, message: string): void
}

export class AutomationEngine {
  readonly cache: AutomationCache
  readonly runner: Runner
  private running: Promise<void> | null = null
  private again = false
  private timer: NodeJS.Timeout | null = null
  private soon: NodeJS.Timeout | null = null
  private unsubscribe: (() => void) | null = null
  private lastPurge = 0
  private alerts = new Map<string, number>()

  constructor(
    private readonly db: DataSource,
    private readonly deps: EngineDeps
  ) {
    this.cache = new AutomationCache(db)
    this.runner = new Runner({
      db,
      handlers: deps.handlers,
      ports: deps.ports,
      definition: (id) => this.cache.definition(id),
      onFailed: (run) => this.failed(run)
    })
  }

  private now(): Date {
    return this.deps.ports.clock.now()
  }

  async start(): Promise<void> {
    await this.recover()
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    this.unsubscribe = onAutomationEvent(() => this.kick())
    void this.tick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.soon) clearTimeout(this.soon)
    this.unsubscribe?.()
  }

  kick(): void {
    if (this.soon) clearTimeout(this.soon)
    this.soon = setTimeout(() => void this.tick(), 300)
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
      } catch (err) {
        console.error('[automations]', err)
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  async runOnce(): Promise<void> {
    await this.cache.refresh()
    await this.drain()
    await this.schedule()
    await this.runDue()
    await this.purge()
  }

  async recover(): Promise<void> {
    const now = this.now()
    await transactionGuard(this.db, async (manager) => {
      const runs = manager.getRepository(AutomationRunModel)
      await runs.update({ status: 'active' }, { nextAt: now.toISOString() })
      const lateBefore = new Date(now.getTime() - LATE_MS).toISOString()
      await runs.update(
        { status: In(['active', 'waiting']), nextAt: LessThan(lateBefore) },
        { late: true }
      )
    })
  }

  private async drain(): Promise<void> {
    const events = await this.db.getRepository(AutomationEventModel).find({
      where: { processedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: EVENTS_PER_TICK
    })
    for (const event of events) await this.process(event)
    if (events.length === EVENTS_PER_TICK) this.again = true
  }

  private async process(event: StoredEvent): Promise<void> {
    const now = this.now()
    const locked: string[] = []
    await transactionGuard(this.db, async (manager) => {
      for (const entry of this.cache.active()) {
        const trigger =
          entry.version.definition.triggers.find((t) =>
            triggerSpec(t.type)?.matches(t, event, entry.automation.id)
          ) ?? manualTrigger(event, entry.automation.id)
        if (!trigger) continue
        const result = await enroll(manager, entry, trigger, event, now)
        if (result.locked) locked.push(entry.automation.id)
      }
      if (event.subject.id) {
        await manager.query(
          `UPDATE automation_runs SET next_at = ? WHERE status = 'waiting' AND subject_type = ?
           AND subject_id = ? AND json_extract(wait, '$.kind') = 'condition'`,
          [now.toISOString(), event.subject.type, event.subject.id]
        )
      }
      await manager
        .getRepository(AutomationEventModel)
        .update({ id: event.id }, { processedAt: now.toISOString() })
    })
    for (const id of locked) {
      this.cache.invalidate()
      this.alert(id, 'Se bloqueó por posible bucle: demasiadas entradas del mismo sujeto.')
    }
  }

  private async schedule(): Promise<void> {
    const now = this.now()
    for (const entry of this.cache.active()) {
      for (const trigger of entry.version.definition.triggers) {
        if (trigger.type !== 'schedule') continue
        const key = `automation_schedule:${entry.automation.id}:${trigger.id}`
        const [row] = (await this.db.query(`SELECT value FROM sync_state WHERE key = ?`, [
          key
        ])) as {
          value: string
        }[]
        const last = row ? new Date(row.value) : null
        if (!last) {
          await this.mark(key, now)
          continue
        }
        const due = nextRun(trigger.params, last)
        if (!due || due > now) continue
        await transactionGuard(this.db, async (manager) => {
          await manager.getRepository(AutomationEventModel).save({
            id: randomUUID(),
            type: 'schedule',
            subject: { type: 'none', id: null },
            payload: {
              automationId: entry.automation.id,
              triggerId: trigger.id,
              scheduledFor: due.toISOString()
            },
            cause: null,
            createdAt: now.toISOString(),
            processedAt: null
          })
          await manager.query(
            `INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, now.toISOString()]
          )
        })
        this.again = true
      }
    }
  }

  private async mark(key: string, at: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, at.toISOString()]
    )
  }

  private async runDue(): Promise<void> {
    const now = this.now()
    const due = await this.db.getRepository(AutomationRunModel).find({
      where: { status: In(['active', 'waiting']), nextAt: LessThanOrEqual(now.toISOString()) },
      order: { nextAt: 'ASC' },
      take: RUNS_PER_TICK
    })
    let advanced = 0
    for (const run of due) {
      const status = this.cache.status(run.automationId)
      if (status === 'paused' || status === 'locked' || status === undefined) continue
      if (run.nextAt && now.getTime() - Date.parse(run.nextAt) > LATE_MS && !run.late)
        await this.db.getRepository(AutomationRunModel).update({ id: run.id }, { late: true })
      const result = await this.runner.advance(run.id)
      advanced++
      if (result) this.deps.onRunChange?.(result)
    }
    if (advanced === RUNS_PER_TICK) this.again = true
  }

  private async purge(): Promise<void> {
    const now = this.now().getTime()
    if (now - this.lastPurge < DAY_MS) return
    this.lastPurge = now
    const cutoff = new Date(now - RETENTION_DAYS * DAY_MS).toISOString()
    const events = new Date(now - 7 * DAY_MS).toISOString()
    await transactionGuard(this.db, async (manager) => {
      const old = await manager.getRepository(AutomationRunModel).find({
        select: { id: true },
        where: { status: In(['finished', 'failed', 'cancelled']), updatedAt: LessThan(cutoff) }
      })
      const ids = old.map((r) => r.id)
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        await manager.getRepository(RunStepModel).delete({ runId: In(chunk) })
        await manager.getRepository(AutomationRunModel).delete({ id: In(chunk) })
      }
      await manager.getRepository(TriggerLogModel).delete({ createdAt: LessThan(cutoff) })
      await manager.getRepository(AutomationEventModel).delete({ processedAt: LessThan(events) })
    })
  }

  private failed(run: AutomationRun): void {
    this.deps.onRunChange?.(run)
    this.alert(run.automationId, run.reason ?? 'Una ejecución falló.')
  }

  private alert(automationId: string, message: string): void {
    const now = this.now().getTime()
    const last = this.alerts.get(automationId) ?? 0
    if (now - last < ALERT_MS) return
    this.alerts.set(automationId, now)
    this.deps.onAlert?.(automationId, message)
  }
}
