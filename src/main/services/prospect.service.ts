import { randomUUID } from 'crypto'
import { In, IsNull, Not, type DataSource, type EntityManager } from 'typeorm'
import {
  STAGE_KINDS,
  type Client,
  type Pipeline,
  type Prospect,
  type ProspectDetail,
  type ProspectInput,
  type Stage,
  type StageKind
} from '@shared/consultora'
import { StageModel } from '../models/stage.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
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
  requiredText
} from './fields'
import { brief } from './meeting.helpers'
import { insertClient } from './client.service'

/** Pipeline de ventas: etapas configurables y prospectos. Ganar crea el cliente. */
export class ProspectService {
  constructor(private readonly db: DataSource) {}

  find(ref: unknown): Promise<Prospect> {
    return findByRef(this.db.getRepository(ProspectModel), ref, 'company', 'el prospecto')
  }

  listStages(): Promise<Stage[]> {
    return this.db.getRepository(StageModel).find({ order: { position: 'ASC' } })
  }

  /** Etapas en orden, cada una con sus prospectos y el valor sumado. */
  async pipeline(): Promise<Pipeline> {
    const stages = await this.listStages()
    const prospects = await this.db
      .getRepository(ProspectModel)
      .find({ order: { position: 'ASC', updatedAt: 'DESC' } })
    const columns = stages.map((stage) => {
      const list = prospects.filter((p) => p.stageId === stage.id)
      return { ...stage, prospects: list, valueUsd: sum(list) }
    })
    return {
      stages: columns,
      openValueUsd: sum(columns.filter((s) => s.kind === 'open').flatMap((s) => s.prospects))
    }
  }

  async get(ref: unknown): Promise<ProspectDetail> {
    const prospect = await this.find(ref)
    const stage = await this.db.getRepository(StageModel).findOneByOrFail({ id: prospect.stageId })
    const meetings = await this.db
      .getRepository(MeetingModel)
      .find({ where: { prospectId: prospect.id }, order: { date: 'DESC' } })
    const contacts = await this.db
      .getRepository(ContactModel)
      .find({ where: { prospectId: prospect.id }, order: { name: 'ASC' } })
    return { ...prospect, stage, contacts, meetings: meetings.map(brief) }
  }

  create(input: ProspectInput): Promise<Prospect> {
    return transactionGuard(this.db, (manager) => insertProspect(manager, input))
  }

  /** Edita datos. Para cambiar de etapa usa `move` (gestiona el paso a cliente). */
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
      if (patch.nextStepDate !== undefined) {
        p.nextStepDate = optionalDay(patch.nextStepDate, 'La fecha del próximo paso')
      }
      p.updatedAt = now()
      return prospects.save(p)
    })
  }

  /**
   * Cambia de etapa y, si viene `index`, lo coloca en esa posición de la columna (arrastrar).
   * Si la etapa es `won` y el prospecto aún no es cliente, crea el cliente (con su carpeta)
   * en la misma transacción y le pasa sus reuniones y contactos de venta.
   */
  move(
    ref: unknown,
    stageRef: unknown,
    index?: number
  ): Promise<{ prospect: Prospect; client: Client | null }> {
    return transactionGuard(this.db, async (manager) => {
      const prospects = manager.getRepository(ProspectModel)
      const p = await findByRef(prospects, ref, 'company', 'el prospecto')
      const stage = await findByRef(manager.getRepository(StageModel), stageRef, 'name', 'la etapa')

      p.stageId = stage.id
      p.updatedAt = now()

      // Reordenar la columna destino con el prospecto en su sitio nuevo
      const column = (await prospects.find({ where: { stageId: stage.id }, order: { position: 'ASC', updatedAt: 'DESC' } }))
        .filter((other) => other.id !== p.id)
      const at = typeof index === 'number' ? Math.max(0, Math.min(Math.floor(index), column.length)) : 0
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

  /**
   * Guarda la lista completa de etapas (renombrar, reordenar, cambiar tipo, añadir).
   * Las etapas que faltan se borran, salvo que tengan prospectos.
   */
  saveStages(input: (Partial<Stage> & { name: string; kind: StageKind })[]): Promise<Stage[]> {
    return transactionGuard(this.db, async (manager) => {
      const stages = manager.getRepository(StageModel)
      if (!Array.isArray(input) || input.length === 0) {
        throw new AppError('invalid', 'El pipeline necesita al menos una etapa.')
      }
      const list: Stage[] = input.map((s, position) => ({
        id: typeof s.id === 'string' && s.id ? s.id : randomUUID(),
        name: requiredText(s.name, 'El nombre de la etapa', 60),
        kind: oneOf(s.kind, STAGE_KINDS, 'El tipo de etapa'),
        position
      }))
      if (!list.some((s) => s.kind === 'open')) {
        throw new AppError('invalid', 'Debe haber al menos una etapa abierta.')
      }

      const removed = await stages.findBy({ id: Not(In(list.map((s) => s.id))) })
      for (const stage of removed) {
        const used = await manager.getRepository(ProspectModel).countBy({ stageId: stage.id })
        if (used)
          throw new AppError(
            'invalid',
            `«${stage.name}» tiene ${used} prospecto(s). Muévelos antes de borrarla.`
          )
      }
      if (removed.length) await stages.delete({ id: In(removed.map((s) => s.id)) })
      await stages.save(list)
      return list
    })
  }
}

const sum = (list: Prospect[]): number => list.reduce((total, p) => total + (p.valueUsd ?? 0), 0)

/**
 * Inserta un prospecto (sin transacción propia). Sin etapa = primera abierta.
 * Exportada para que «pasar a pipeline» de un contacto lo cree en su misma transacción.
 */
export async function insertProspect(manager: EntityManager, input: ProspectInput): Promise<Prospect> {
  const stages = manager.getRepository(StageModel)
  const stage = input.stage
    ? await findByRef(stages, input.stage, 'name', 'la etapa')
    : await stages.findOne({ where: { kind: 'open' }, order: { position: 'ASC' } })
  if (!stage) throw new AppError('invalid', 'No hay etapas abiertas en el pipeline.')

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
    createdAt: stamp,
    updatedAt: stamp
  }
  await manager.getRepository(ProspectModel).insert(prospect)
  return prospect
}
