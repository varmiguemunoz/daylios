import { randomUUID } from 'crypto'
import type { EntityManager } from 'typeorm'
import { OutboxModel, type OutboxJob } from '../models/marketing.model'
import { now } from './fields'

type Listener = () => void
const listeners = new Set<Listener>()

export function onEnqueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = (): void => {
  // Tras la transacción: el sync abre la suya y debe ver el job ya guardado.
  setTimeout(() => listeners.forEach((l) => l()), 0)
}

export async function enqueueContactSync(
  manager: EntityManager,
  contactId: string,
  extra: { previousEmail?: string | null; resubscribe?: boolean } = {}
): Promise<void> {
  const repo = manager.getRepository(OutboxModel)
  const pending = await repo.findOneBy({ kind: 'contact', ref: contactId })
  const previous = extra.previousEmail ? [extra.previousEmail] : []
  if (pending) {
    const merged = [
      ...new Set([...((pending.payload.previousEmails as string[]) ?? []), ...previous])
    ]
    pending.payload = {
      ...pending.payload,
      previousEmails: merged,
      resubscribe: Boolean(pending.payload.resubscribe || extra.resubscribe)
    }
    pending.nextAt = now()
    await repo.save(pending)
  } else {
    await repo.save(
      job('contact', contactId, {
        previousEmails: previous,
        resubscribe: Boolean(extra.resubscribe)
      })
    )
  }
  notify()
}

export async function enqueueEvent(
  manager: EntityManager,
  contactId: string,
  event: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await manager.getRepository(OutboxModel).save(job('event', contactId, { event, payload }))
  notify()
}

export async function enqueueSegmentDelete(
  manager: EntityManager,
  slug: string,
  segmentId: string
): Promise<void> {
  await manager.getRepository(OutboxModel).save(job('segment_delete', slug, { segmentId }))
  notify()
}

let lastStamp = 0
function stamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp).toISOString()
}

function job(kind: OutboxJob['kind'], ref: string, payload: Record<string, unknown>): OutboxJob {
  const created = stamp()
  return {
    id: randomUUID(),
    kind,
    ref,
    payload,
    attempts: 0,
    lastError: null,
    nextAt: now(),
    createdAt: created
  }
}
