import { randomUUID } from 'crypto'
import { In, IsNull, Not, type DataSource, type EntityManager } from 'typeorm'
import {
  STAGE_KINDS,
  type Client,
  type Pipeline,
  type PipelineInput,
  type PipelineSummary,
  type Prospect,
  type ProspectCard,
  type ProspectDetail,
  type ProspectInput,
  type Stage,
  type StageInput
} from '@shared/consultora'
import type { TagRef } from '@shared/marketing'
import { StageModel } from '../models/stage.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
import { PipelineModel } from '../models/pipeline.model'
import { StageEventModel } from '../models/metrics.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import {
  markdown,
  now,
  oneOf,
  optionalAmount,
  optionalDay,
  optionalText,
  optionalUserId,
  requiredText
} from './fields'
import { brief } from './meeting.helpers'
import { insertClient } from './client.service'
import { tagsByContact } from './tag.service'
import { findPipeline, findStage, firstOpenStage } from './pipeline.helpers'
import { unlinkTasks } from './task.service'

export class ProspectService {
  constructor(private readonly db: DataSource) {}

  find(ref: unknown): Promise<Prospect> {
    return findByRef(this.db.getRepository(ProspectModel), ref, 'company', 'el prospecto')
  }

  // ---- pipelines ----

  async listPipelines(): Promise<PipelineSummary[]> {
    const pipelines = await this.db
      .getRepository(PipelineModel)
      .find({ order: { position: 'ASC', createdAt: 'ASC' } })
    const stages = await this.db.getRepository(StageModel).find()
    const prospects = await this.db.getRepository(ProspectModel).find()
    return pipelines.map((p) => {
      const own = stages.filter((s) => s.pipelineId === p.id)
      const open = new Set(own.filter((s) => s.kind === 'open').map((s) => s.id))
      const ids = new Set(own.map((s) => s.id))
      const list = prospects.filter((x) => ids.has(x.stageId))
      return {
        id: p.id,
        name: p.name,
        position: p.position,
        stages: own.length,
        prospects: list.length,
        openValueUsd: sum(list.filter((x) => open.has(x.stageId)))
      }
    })
  }

  async pipeline(ref?: unknown): Promise<Pipeline> {
    const manager = this.db.manager
    const pipeline = await findPipeline(manager, ref)
    const stages = await manager
      .getRepository(StageModel)
      .find({ where: { pipelineId: pipeline.id }, order: { position: 'ASC' } })
    const prospects = stages.length
      ? await manager.getRepository(ProspectModel).find({
          where: { stageId: In(stages.map((s) => s.id)) },
          order: { position: 'ASC', updatedAt: 'DESC' }
        })
      : []
    const cards = await toCards(manager, prospects)
    const columns = stages.map((stage) => {
      const list = cards.filter((p) => p.stageId === stage.id)
      return { ...stage, prospects: list, valueUsd: sum(list) }
    })
    return {
      pipeline: { id: pipeline.id, name: pipeline.name, position: pipeline.position },
      stages: columns,
      openValueUsd: sum(columns.filter((s) => s.kind === 'open').flatMap((s) => s.prospects))
    }
  }

  async savePipeline(input: PipelineInput): Promise<Pipeline> {
    const id = await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(PipelineModel)
      const stamp = now()
      const name = requiredText(input?.name, 'El nombre del pipeline', 60)
      let pipeline = input?.id ? await findPipeline(manager, input.id) : null
      if (pipeline) {
        pipeline.name = name
        pipeline.updatedAt = stamp
        await repo.save(pipeline)
      } else {
        const last = await repo.findOne({ where: {}, order: { position: 'DESC' } })
        pipeline = {
          id: randomUUID(),
          name,
          position: (last?.position ?? -1) + 1,
          createdAt: stamp,
          updatedAt: stamp
        }
        await repo.insert(pipeline)
      }
      const stages =
        input?.stages ??
        (input?.id
          ? undefined
          : [
              { name: 'Lead', kind: 'open' as const },
              { name: 'Contactado', kind: 'open' as const },
              { name: 'Propuesta', kind: 'open' as const },
              { name: 'Ganado', kind: 'won' as const },
              { name: 'Perdido', kind: 'lost' as const }
            ])
      if (stages) await replaceStages(manager, pipeline.id, stages, input?.moves ?? [])
      return pipeline.id
    })
    return this.pipeline(id)
  }

  removePipeline(ref: unknown, moveTo?: { pipeline: string; stage?: string }): Promise<void> {
    return transactionGuard(this.db, async (manager) => {
      const pipeline = await findPipeline(manager, ref)
      if ((await manager.getRepository(PipelineModel).count()) <= 1) {
        throw new AppError('invalid', 'Debe quedar al menos un pipeline.')
      }
      const stages = await manager.getRepository(StageModel).findBy({ pipelineId: pipeline.id })
      const prospects = manager.getRepository(ProspectModel)
      const count = stages.length
        ? await prospects.countBy({ stageId: In(stages.map((s) => s.id)) })
        : 0
      if (count) {
        if (!moveTo?.pipeline) {
          throw new AppError(
            'invalid',
            `«${pipeline.name}» tiene ${count} prospecto(s). Elige a qué pipeline moverlos.`
          )
        }
        const target = await findPipeline(manager, moveTo.pipeline)
        if (target.id === pipeline.id) throw new AppError('invalid', 'Elige otro pipeline.')
        const stage = moveTo.stage
          ? await findStage(manager, moveTo.stage, target.id)
          : await firstOpenStage(manager, target.id)
        if (stage.pipelineId !== target.id)
          throw new AppError('invalid', 'La etapa no es de ese pipeline.')
        await prospects.update(
          { stageId: In(stages.map((s) => s.id)) },
          { stageId: stage.id, updatedAt: now() }
        )
      }
      if (stages.length)
        await manager.getRepository(StageModel).softDelete({ pipelineId: pipeline.id })
      await manager.getRepository(PipelineModel).softDelete({ id: pipeline.id })
    })
  }

  // ---- etapas ----

  async listStages(pipeline?: unknown): Promise<Stage[]> {
    const repo = this.db.getRepository(StageModel)
    if (pipeline === undefined || pipeline === null || pipeline === '') {
      return repo.find({ order: { position: 'ASC' } })
    }
    const p = await findPipeline(this.db.manager, pipeline)
    return repo.find({ where: { pipelineId: p.id }, order: { position: 'ASC' } })
  }

  async saveStages(input: StageInput[]): Promise<Stage[]> {
    const first = await findPipeline(this.db.manager)
    await transactionGuard(this.db, (manager) => replaceStages(manager, first.id, input, []))
    return this.listStages(first.id)
  }

  // ---- prospectos ----

  async get(ref: unknown): Promise<ProspectDetail> {
    const prospect = await this.find(ref)
    const stage = await this.db.getRepository(StageModel).findOneByOrFail({ id: prospect.stageId })
    const pipeline = await this.db
      .getRepository(PipelineModel)
      .findOneByOrFail({ id: stage.pipelineId })
    const meetings = await this.db
      .getRepository(MeetingModel)
      .find({ where: { prospectId: prospect.id }, order: { date: 'DESC' } })
    const contacts = await this.db
      .getRepository(ContactModel)
      .find({ where: { prospectId: prospect.id }, order: { name: 'ASC' } })
    return {
      ...prospect,
      stage,
      pipeline: { id: pipeline.id, name: pipeline.name, position: pipeline.position },
      contacts,
      meetings: meetings.map(brief)
    }
  }

  create(input: ProspectInput): Promise<Prospect> {
    return transactionGuard(this.db, (manager) => insertProspect(manager, input))
  }

  update(ref: unknown, patch: ProspectInput): Promise<Prospect> {
    return transactionGuard(this.db, async (manager) => {
      const prospects = manager.getRepository(ProspectModel)
      const p = await findByRef(prospects, ref, 'company', 'el prospecto')
      if (patch.company !== undefined) p.company = requiredText(patch.company, 'La empresa')
      if (patch.contactMd !== undefined) p.contactMd = markdown(patch.contactMd, 'El contacto')
      if (patch.valueUsd !== undefined) p.valueUsd = optionalAmount(patch.valueUsd, 'El valor')
      if (patch.source !== undefined) p.source = optionalText(patch.source, 'El origen')
      if (patch.notesMd !== undefined) p.notesMd = markdown(patch.notesMd, 'Las notas')
      if (patch.nextStep !== undefined) p.nextStep = optionalText(patch.nextStep, 'El próximo paso')
      if (patch.assigneeId !== undefined) p.assigneeId = optionalUserId(patch.assigneeId)
      if (patch.nextStepDate !== undefined) {
        p.nextStepDate = optionalDay(patch.nextStepDate, 'La fecha del próximo paso')
      }
      p.updatedAt = now()
      return prospects.save(p)
    })
  }

  move(
    ref: unknown,
    stageRef: unknown,
    index?: number,
    pipelineRef?: unknown
  ): Promise<{ prospect: Prospect; client: Client | null }> {
    return transactionGuard(this.db, async (manager) => {
      const prospects = manager.getRepository(ProspectModel)
      const p = await findByRef(prospects, ref, 'company', 'el prospecto')
      const current = await manager.getRepository(StageModel).findOneBy({ id: p.stageId })
      const scope = pipelineRef
        ? (await findPipeline(manager, pipelineRef)).id
        : current?.pipelineId
      const stage = await findStage(manager, stageRef, scope)

      await recordStage(manager, p, current, stage)
      p.stageId = stage.id
      p.updatedAt = now()

      // Reordenar la columna destino con el prospecto en su sitio nuevo
      const column = (
        await prospects.find({
          where: { stageId: stage.id },
          order: { position: 'ASC', updatedAt: 'DESC' }
        })
      ).filter((other) => other.id !== p.id)
      const at =
        typeof index === 'number' ? Math.max(0, Math.min(Math.floor(index), column.length)) : 0
      column.splice(at, 0, p)
      for (const [position, row] of column.entries()) {
        if (row.id !== p.id) await prospects.update({ id: row.id }, { position })
        else p.position = position
      }

      let client: Client | null = null
      if (stage.kind === 'won' && !p.clientId) {
        client = await insertClient(manager, {
          name: p.company,
          contactsMd: p.contactMd,
          notesMd: p.notesMd ? `## Del pipeline\n\n${p.notesMd}` : ''
        })
        p.clientId = client.id
        await manager
          .getRepository(MeetingModel)
          .update({ prospectId: p.id, clientId: IsNull() }, { clientId: client.id })
        await manager
          .getRepository(ContactModel)
          .update({ prospectId: p.id, clientId: IsNull() }, { clientId: client.id })
      }

      return { prospect: await prospects.save(p), client }
    })
  }

  remove(ref: unknown): Promise<void> {
    return transactionGuard(this.db, (manager) => removeProspect(manager, ref))
  }
}

const sum = (list: Prospect[]): number => list.reduce((total, p) => total + (p.valueUsd ?? 0), 0)

async function toCards(manager: EntityManager, prospects: Prospect[]): Promise<ProspectCard[]> {
  if (!prospects.length) return []
  const contacts = await manager
    .getRepository(ContactModel)
    .find({ where: { prospectId: In(prospects.map((p) => p.id)) }, order: { createdAt: 'ASC' } })
  const tags = await tagsByContact(
    manager,
    contacts.map((c) => c.id)
  )
  return prospects.map((p) => {
    const own = contacts.filter((c) => c.prospectId === p.id)
    const main = own[0]
    const seen = new Map<string, TagRef>()
    for (const c of own)
      for (const t of tags.get(c.id) ?? []) seen.set(t.slug, { slug: t.slug, name: t.name })
    return {
      ...p,
      contact: main ? { id: main.id, name: main.name || main.email || 'Sin nombre' } : null,
      tags: [...seen.values()]
    }
  })
}

async function replaceStages(
  manager: EntityManager,
  pipelineId: string,
  input: StageInput[],
  moves: { from: string; to: string }[]
): Promise<void> {
  const stages = manager.getRepository(StageModel)
  if (!Array.isArray(input) || input.length === 0) {
    throw new AppError('invalid', 'El pipeline necesita al menos una etapa.')
  }
  const current = await stages.findBy({ pipelineId })
  const own = new Set(current.map((s) => s.id))
  const list: Stage[] = input.map((s, position) => ({
    id: typeof s.id === 'string' && own.has(s.id) ? s.id : randomUUID(),
    name: requiredText(s.name, 'El nombre de la etapa', 60),
    kind: oneOf(s.kind, STAGE_KINDS, 'El tipo de etapa'),
    position,
    pipelineId
  }))
  if (!list.some((s) => s.kind === 'open')) {
    throw new AppError('invalid', 'Debe haber al menos una etapa abierta.')
  }

  const kept = new Set(list.map((s) => s.id))
  const removed = await stages.findBy({ pipelineId, id: Not(In([...kept])) })
  const prospects = manager.getRepository(ProspectModel)
  for (const stage of removed) {
    const used = await prospects.countBy({ stageId: stage.id })
    if (!used) continue
    const move = moves.find((m) => m.from === stage.id)
    if (!move || !kept.has(move.to)) {
      throw new AppError(
        'invalid',
        `«${stage.name}» tiene ${used} prospecto(s). Elige a qué columna moverlos.`
      )
    }
    await prospects.update({ stageId: stage.id }, { stageId: move.to, updatedAt: now() })
  }
  if (removed.length) await stages.softDelete({ id: In(removed.map((s) => s.id)) })
  await stages.save(list)
}

export async function removeProspect(manager: EntityManager, ref: unknown): Promise<void> {
  const prospect = await findByRef(
    manager.getRepository(ProspectModel),
    ref,
    'company',
    'el prospecto'
  )
  await manager
    .getRepository(ContactModel)
    .update({ prospectId: prospect.id }, { prospectId: null })
  await manager
    .getRepository(MeetingModel)
    .update({ prospectId: prospect.id }, { prospectId: null })
  await unlinkTasks(manager, 'prospect', prospect.id)
  await manager.getRepository(StageEventModel).delete({ prospectId: prospect.id })
  await manager.getRepository(ProspectModel).softDelete({ id: prospect.id })
}

export async function insertProspect(
  manager: EntityManager,
  input: ProspectInput
): Promise<Prospect> {
  const pipeline = await findPipeline(manager, input.pipeline)
  const stage = input.stage
    ? await findStage(manager, input.stage, pipeline.id)
    : await firstOpenStage(manager, pipeline.id)

  const stamp = now()
  const prospect: Prospect = {
    id: randomUUID(),
    company: requiredText(input.company, 'La empresa'),
    contactMd: markdown(input.contactMd, 'El contacto'),
    valueUsd: optionalAmount(input.valueUsd, 'El valor'),
    source: optionalText(input.source, 'El origen'),
    stageId: stage.id,
    // Nuevo = arriba de su columna
    position: -1,
    notesMd: markdown(input.notesMd, 'Las notas'),
    nextStep: optionalText(input.nextStep, 'El próximo paso'),
    nextStepDate: optionalDay(input.nextStepDate, 'La fecha del próximo paso'),
    clientId: null,
    closedAt: null,
    assigneeId: optionalUserId(input.assigneeId),
    createdAt: stamp,
    updatedAt: stamp
  }
  await recordStage(manager, prospect, null, stage)
  await manager.getRepository(ProspectModel).insert(prospect)
  return prospect
}

export async function recordStage(
  manager: EntityManager,
  p: Prospect,
  from: Stage | null,
  to: Stage
): Promise<void> {
  if (from?.id === to.id) return
  const at = now()
  await manager.getRepository(StageEventModel).insert({
    id: randomUUID(),
    prospectId: p.id,
    pipelineId: to.pipelineId,
    fromStageId: from?.id ?? null,
    toStageId: to.id,
    toKind: to.kind,
    valueUsd: p.valueUsd,
    source: 'app',
    at
  })
  if (to.kind === 'open') p.closedAt = null
  else if (from?.kind !== to.kind || !p.closedAt) p.closedAt = at
}
