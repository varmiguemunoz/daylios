import { randomUUID } from 'crypto'
import { In, MoreThanOrEqual, type EntityManager } from 'typeorm'
import {
  evaluate,
  LOOP_LIMIT,
  MAX_DEPTH,
  type AutomationEvent,
  type Origin,
  type StoredEvent,
  type TriggerDef,
  type TriggerOutcome
} from '@shared/automations'
import { AutomationModel, AutomationRunModel, TriggerLogModel } from '../models/automation.model'
import type { CacheEntry } from './cache'
import { loadScope } from './scope'

export interface EnrollResult {
  outcome: TriggerOutcome
  reason: string | null
  runId: string | null
  locked: boolean
}

const ORIGINS: Origin[] = ['user', 'claude', 'system']

export function publicEvent(event: StoredEvent | AutomationEvent): AutomationEvent {
  return {
    id: event.id,
    type: event.type,
    subject: event.subject,
    payload: event.payload,
    createdAt: event.createdAt
  }
}

async function log(
  manager: EntityManager,
  entry: CacheEntry,
  trigger: TriggerDef,
  event: StoredEvent,
  outcome: TriggerOutcome,
  reason: string | null,
  now: Date
): Promise<void> {
  await manager.getRepository(TriggerLogModel).insert({
    id: randomUUID(),
    automationId: entry.automation.id,
    triggerId: trigger.id,
    eventId: event.id,
    subjectId: event.subject.id,
    outcome,
    reason,
    createdAt: now.toISOString()
  })
}

export async function enroll(
  manager: EntityManager,
  entry: CacheEntry,
  trigger: TriggerDef,
  event: StoredEvent,
  now: Date
): Promise<EnrollResult> {
  const def = entry.version.definition
  const automationId = entry.automation.id
  const done = async (
    outcome: TriggerOutcome,
    reason: string | null,
    locked = false
  ): Promise<EnrollResult> => {
    await log(manager, entry, trigger, event, outcome, reason, now)
    return { outcome, reason, runId: null, locked }
  }

  const current = await manager.getRepository(AutomationModel).findOneBy({ id: automationId })
  if (!current || current.status !== 'active')
    return done('paused', 'La automatización no está activa.')

  const subjectId = def.subject === 'none' ? null : event.subject.id
  if (def.subject !== 'none' && (event.subject.type !== def.subject || !subjectId))
    return done('filtered', 'El evento es de otro tipo de sujeto.')

  if (trigger.conditions?.length) {
    const scope = await loadScope(
      manager,
      { subjectType: def.subject, subjectId, event: publicEvent(event), outputs: {} },
      now
    )
    if (!evaluate(trigger.conditions, scope))
      return done('filtered', 'No cumple las condiciones del trigger.')
  }

  const cause = event.cause
  if (cause && cause.depth >= MAX_DEPTH)
    return done(
      'loop_limit',
      `Cadena de ${cause.depth} automatizaciones; se corta para evitar bucles.`
    )
  if (cause?.chain.includes(automationId))
    return done('loop_limit', 'La automatización se dispararía a sí misma en la misma cadena.')

  const runs = manager.getRepository(AutomationRunModel)
  if (subjectId) {
    const since = new Date(now.getTime() - LOOP_LIMIT.minutes * 60_000).toISOString()
    const recent = await runs.countBy({
      automationId,
      subjectId,
      createdAt: MoreThanOrEqual(since)
    })
    if (recent >= LOOP_LIMIT.count) {
      await manager
        .getRepository(AutomationModel)
        .update({ id: automationId }, { status: 'locked', updatedAt: now.toISOString() })
      return done(
        'loop_limit',
        `Más de ${LOOP_LIMIT.count} entradas en ${LOOP_LIMIT.minutes} minutos.`,
        true
      )
    }
    const open = await runs.countBy({ automationId, subjectId, status: In(['active', 'waiting']) })
    if (open > 0) return done('already_enrolled', 'Ya está dentro de esta automatización.')
    if (def.settings.reentry === 'never' && (await runs.countBy({ automationId, subjectId })) > 0)
      return done(
        'already_enrolled',
        'Ya pasó por esta automatización y no admite volver a entrar.'
      )
  }

  const stamp = now.toISOString()
  const origin = ORIGINS.includes(event.payload.origin as Origin)
    ? (event.payload.origin as Origin)
    : 'system'
  const id = randomUUID()
  await runs.save({
    id,
    automationId,
    versionId: entry.version.id,
    subjectType: def.subject,
    subjectId,
    triggerId: trigger.id,
    event: publicEvent(event),
    status: def.root ? 'active' : 'finished',
    nodeId: def.root,
    nextAt: def.root ? stamp : null,
    wait: null,
    attempts: 0,
    outputs: {},
    depth: cause?.depth ?? 0,
    chain: cause?.chain ?? [],
    causeRunId: cause?.runId ?? null,
    late: false,
    reason: null,
    origin,
    createdAt: stamp,
    updatedAt: stamp,
    finishedAt: def.root ? null : stamp
  })
  await log(manager, entry, trigger, event, 'enrolled', null, now)
  return { outcome: 'enrolled', reason: null, runId: id, locked: false }
}
