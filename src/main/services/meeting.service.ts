import { randomUUID } from 'crypto'
import type { DataSource, EntityManager, FindOptionsWhere } from 'typeorm'
import { toDayKey } from '@shared/tasks'
import {
  normalizeName,
  type ActionItem,
  type Meeting,
  type MeetingFilter,
  type MeetingInput,
  type MeetingsPage,
  type OpenActionItem
} from '@shared/consultora'
import { MeetingModel } from '../models/meeting.model'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { markdown, now, optionalText, requiredText } from './fields'
import { actionItems, brief } from './meeting.helpers'
import { moveInto } from './documents'
import { pageByDay } from './page-by-day'

/** Reuniones: notas, asociación a cliente/proyecto/prospecto y action items. La grabación vive en recording.service. */
export class MeetingService {
  constructor(private readonly db: DataSource) {}

  async get(id: unknown): Promise<Meeting> {
    const meeting =
      typeof id === 'string' ? await this.db.getRepository(MeetingModel).findOneBy({ id }) : null
    if (!meeting) throw new AppError('not_found', 'No existe esa reunión.')
    return meeting
  }

  /** Reuniones por día (más reciente primero), filtrables por cliente, proyecto, prospecto y fechas. */
  async list(filter: MeetingFilter): Promise<MeetingsPage> {
    const where: FindOptionsWhere<Meeting> = {}
    if (filter.client)
      where.clientId = (
        await findByRef(this.db.getRepository(ClientModel), filter.client, 'name', 'el cliente')
      ).id
    if (filter.project)
      where.projectId = (
        await findByRef(this.db.getRepository(ProjectModel), filter.project, 'name', 'el proyecto')
      ).id
    if (filter.prospect) {
      where.prospectId = (
        await findByRef(
          this.db.getRepository(ProspectModel),
          filter.prospect,
          'company',
          'el prospecto'
        )
      ).id
    }

    const meetings = await this.db
      .getRepository(MeetingModel)
      .find({ where, order: { date: 'DESC' } })
    // Filtro de fechas por día local (la fecha se guarda en ISO UTC).
    const items = meetings
      .map((m) => ({ date: toDayKey(new Date(m.date)), meeting: brief(m) }))
      .filter((i) => (!filter.from || i.date >= filter.from) && (!filter.to || i.date <= filter.to))

    const { days, ...pages } = pageByDay(items, filter.page ?? 1, filter.pageSize ?? 7)
    return {
      ...pages,
      days: days.map((d) => ({ date: d.date, meetings: d.items.map((i) => i.meeting) }))
    }
  }

  /** Reunión sin grabación (notas a mano). Luego se puede resumir con processMeeting. */
  create(input: MeetingInput): Promise<Meeting> {
    return transactionGuard(this.db, async (manager) => {
      const stamp = now()
      const meeting: Meeting = {
        id: randomUUID(),
        date: input.date ? checkDate(input.date) : stamp,
        title: input.title ? requiredText(input.title, 'El título') : 'Reunión',
        clientId: null,
        projectId: null,
        prospectId: null,
        participants: checkParticipants(input.participants ?? []),
        summaryMd: markdown(input.summaryMd, 'El resumen'),
        decisionsMd: markdown(input.decisionsMd, 'Las decisiones'),
        actionItems: checkActionItems(input.actionItems ?? []),
        transcriptMd: '',
        rawNotesMd: markdown(input.rawNotesMd, 'Las notas'),
        recordingPath: null,
        durationSec: null,
        status: 'ready',
        error: null,
        createdAt: stamp,
        updatedAt: stamp
      }
      await associate(manager, meeting, input)
      await manager.getRepository(MeetingModel).insert(meeting)
      return meeting
    })
  }

  update(id: unknown, patch: MeetingInput): Promise<Meeting> {
    return transactionGuard(this.db, async (manager) => {
      const meetings = manager.getRepository(MeetingModel)
      const meeting = await this.get(id)
      if (patch.title !== undefined) meeting.title = requiredText(patch.title, 'El título')
      if (patch.date !== undefined) meeting.date = checkDate(patch.date)
      if (patch.participants !== undefined)
        meeting.participants = checkParticipants(patch.participants)
      if (patch.summaryMd !== undefined) meeting.summaryMd = markdown(patch.summaryMd, 'El resumen')
      if (patch.decisionsMd !== undefined)
        meeting.decisionsMd = markdown(patch.decisionsMd, 'Las decisiones')
      if (patch.actionItems !== undefined) meeting.actionItems = checkActionItems(patch.actionItems)
      if (patch.rawNotesMd !== undefined)
        meeting.rawNotesMd = markdown(patch.rawNotesMd, 'Las notas')
      await associate(manager, meeting, patch)
      meeting.updatedAt = now()
      return meetings.save(meeting)
    })
  }

  /** Borra la reunión. El archivo de grabación se queda en su carpeta. */
  async remove(id: unknown): Promise<void> {
    await transactionGuard(this.db, async (manager) => {
      const meeting = await this.get(id)
      await manager.getRepository(MeetingModel).delete({ id: meeting.id })
    })
  }

  /** Cambia un action item (p. ej. `{ done: true }`) por su posición en la reunión. */
  updateActionItem(id: unknown, index: number, patch: Partial<ActionItem>): Promise<Meeting> {
    return transactionGuard(this.db, async (manager) => {
      const meeting = await this.get(id)
      const item = meeting.actionItems[index]
      if (!item) throw new AppError('not_found', 'No existe ese action item.')
      meeting.actionItems[index] = checkActionItems([{ ...item, ...patch }])[0]
      meeting.updatedAt = now()
      return manager.getRepository(MeetingModel).save(meeting)
    })
  }

  /** Action items de todas las reuniones (o de un cliente). Por defecto, solo los abiertos. */
  async listActionItems(filter: { client?: string; done?: boolean }): Promise<OpenActionItem[]> {
    const where: FindOptionsWhere<Meeting> = {}
    if (filter.client)
      where.clientId = (
        await findByRef(this.db.getRepository(ClientModel), filter.client, 'name', 'el cliente')
      ).id
    const meetings = await this.db.getRepository(MeetingModel).findBy(where)
    const done = filter.done ?? false
    return actionItems(meetings).filter((item) => item.done === done)
  }

  /**
   * Propone asociación según el título: el nombre más largo de cliente, proyecto o prospecto
   * que aparezca en el título. Un proyecto también fija su cliente.
   */
  async suggestAssociation(title: string): Promise<{
    clientId: string | null
    projectId: string | null
    prospectId: string | null
  }> {
    const text = normalizeName(title ?? '')
    const best = <T>(rows: T[], name: (row: T) => string): T | null =>
      rows
        .filter(
          (row) => normalizeName(name(row)).length >= 3 && text.includes(normalizeName(name(row)))
        )
        .sort((a, b) => name(b).length - name(a).length)[0] ?? null

    const project = best(await this.db.getRepository(ProjectModel).find(), (p) => p.name)
    const client = best(await this.db.getRepository(ClientModel).find(), (c) => c.name)
    const prospect = best(await this.db.getRepository(ProspectModel).find(), (p) => p.company)

    return {
      clientId: project?.clientId ?? client?.id ?? prospect?.clientId ?? null,
      projectId: project?.id ?? null,
      prospectId: prospect?.id ?? null
    }
  }
}

/**
 * Aplica `client` / `project` / `prospect` (id o nombre; '' quita). Un proyecto o un prospecto
 * ya convertido fijan el cliente si falta. Si hay cliente, la grabación se mueve a su carpeta Reuniones/.
 */
export async function associate(
  manager: EntityManager,
  meeting: Meeting,
  input: MeetingInput
): Promise<void> {
  if (input.client !== undefined) {
    meeting.clientId = input.client
      ? (await findByRef(manager.getRepository(ClientModel), input.client, 'name', 'el cliente')).id
      : null
  }
  if (input.project !== undefined) {
    const project = input.project
      ? await findByRef(manager.getRepository(ProjectModel), input.project, 'name', 'el proyecto')
      : null
    meeting.projectId = project?.id ?? null
    if (project && !meeting.clientId) meeting.clientId = project.clientId
  }
  if (input.prospect !== undefined) {
    const prospect = input.prospect
      ? await findByRef(
          manager.getRepository(ProspectModel),
          input.prospect,
          'company',
          'el prospecto'
        )
      : null
    meeting.prospectId = prospect?.id ?? null
    if (prospect?.clientId && !meeting.clientId) meeting.clientId = prospect.clientId
  }

  if (meeting.clientId && meeting.recordingPath) {
    const client = await manager.getRepository(ClientModel).findOneBy({ id: meeting.clientId })
    if (client)
      meeting.recordingPath = await moveInto(meeting.recordingPath, client.folderPath, 'Reuniones')
  }
}

function checkDate(value: unknown): string {
  const date = typeof value === 'string' ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) throw new AppError('invalid', 'La fecha no es válida.')
  return date.toISOString()
}

function checkParticipants(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AppError('invalid', 'Los participantes deben ser una lista.')
  return value.map((p) => requiredText(p, 'Cada participante', 120))
}

function checkActionItems(value: unknown): ActionItem[] {
  if (!Array.isArray(value)) throw new AppError('invalid', 'Los action items deben ser una lista.')
  return value.map((item) => ({
    text: requiredText(item?.text, 'Cada action item', 500),
    owner: optionalText(item?.owner, 'El responsable', 120),
    due: optionalText(item?.due, 'La fecha límite', 60),
    done: item?.done === true
  }))
}
