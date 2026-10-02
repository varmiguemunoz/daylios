import { randomUUID } from 'crypto'
import type { EntityManager } from 'typeorm'
import { OutboxModel, type OutboxJob } from '../models/marketing.model'
import { now } from './fields'

/**
 * Cola local hacia Resend. Los servicios encolan dentro de su transacción; `marketing-sync`
 * la vacía con reintentos. Así ninguna escritura del usuario falla porque Resend no responda.
 */

type Listener = () => void
const listeners = new Set<Listener>()

/** Avisa cuando hay trabajo nuevo (el sync lo usa para no esperar al próximo minuto). */
export function onEnqueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = (): void => {
  // Tras la transacción: el sync abre la suya y debe ver el job ya guardado.
  setTimeout(() => listeners.forEach((l) => l()), 0)
}

/**
 * Sincronizar un contacto (crear/actualizar en Resend y reconciliar segments).
 * Un solo job pendiente por contacto: si ya hay uno, se fusionan los emails anteriores.
 * `previousEmail` = email que tenía en Resend y que hay que dar de baja (cambio o borrado).
 * `resubscribe` = el dueño lo volvió a suscribir a mano: se permite reactivar una baja de Resend.
 */
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

/** Disparar un evento de Resend (`tag.<slug>`, `lead.created`…) para un contacto. */
export async function enqueueEvent(
  manager: EntityManager,
  contactId: string,
  event: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await manager.getRepository(OutboxModel).save(job('event', contactId, { event, payload }))
  notify()
}

/** Marca de tiempo estrictamente creciente: el orden de la cola es el orden en que se encoló. */
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
