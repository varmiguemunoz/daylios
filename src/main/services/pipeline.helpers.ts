import type { EntityManager } from 'typeorm'
import { normalizeName, type Stage } from '@shared/consultora'
import { PipelineModel, type PipelineRow } from '../models/pipeline.model'
import { StageModel } from '../models/stage.model'
import { AppError } from './app.error'
import { findByRef } from './ref'

export async function findPipeline(manager: EntityManager, ref?: unknown): Promise<PipelineRow> {
  const repo = manager.getRepository(PipelineModel)
  if (ref === undefined || ref === null || ref === '') {
    const first = await repo.findOne({ where: {}, order: { position: 'ASC', createdAt: 'ASC' } })
    if (!first) throw new AppError('invalid', 'No hay pipelines.')
    return first
  }
  return findByRef(repo, ref, 'name', 'el pipeline')
}

export async function findStage(
  manager: EntityManager,
  ref: unknown,
  pipelineId?: string
): Promise<Stage> {
  const repo = manager.getRepository(StageModel)
  if (typeof ref !== 'string' || !ref.trim()) throw new AppError('invalid', 'Indica la etapa.')
  const byId = await repo.findOneBy({ id: ref })
  if (byId) return byId
  if (!pipelineId) return findByRef(repo, ref, 'name', 'la etapa')
  const wanted = normalizeName(ref)
  const stages = await repo.findBy({ pipelineId })
  const exact = stages.filter((s) => normalizeName(s.name) === wanted)
  const matches = exact.length
    ? exact
    : stages.filter((s) => normalizeName(s.name).includes(wanted))
  if (matches.length === 1) return matches[0]
  if (!matches.length)
    throw new AppError('not_found', `No encontré la etapa «${ref}» en ese pipeline.`)
  throw new AppError(
    'invalid',
    `«${ref}» coincide con varias etapas. Usa el nombre completo o el id.`
  )
}

export async function firstOpenStage(manager: EntityManager, pipelineId: string): Promise<Stage> {
  const stage = await manager
    .getRepository(StageModel)
    .findOne({ where: { pipelineId, kind: 'open' }, order: { position: 'ASC' } })
  if (!stage) throw new AppError('invalid', 'Ese pipeline no tiene etapas abiertas.')
  return stage
}
