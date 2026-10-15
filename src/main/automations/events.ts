import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'
import type { EntityManager } from 'typeorm'
import type { Cause, SubjectType, TriggerType } from '@shared/automations'
import { AutomationEventModel } from '../models/automation.model'
import { afterCommit } from '../guards/transaction.guard'

const causes = new AsyncLocalStorage<Cause>()
const listeners = new Set<() => void>()

export function withCause<T>(cause: Cause, work: () => Promise<T>): Promise<T> {
  return causes.run(cause, work)
}

export function currentCause(): Cause | null {
  return causes.getStore() ?? null
}

export function onAutomationEvent(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function emit(
  manager: EntityManager,
  type: TriggerType,
  subject: { type: SubjectType; id: string | null },
  payload: Record<string, unknown> = {},
  at: string = new Date().toISOString()
): Promise<void> {
  await manager.getRepository(AutomationEventModel).save({
    id: randomUUID(),
    type,
    subject,
    payload,
    cause: currentCause(),
    createdAt: at,
    processedAt: null
  })
  afterCommit(manager, () => {
    for (const listener of listeners) listener()
  })
}
