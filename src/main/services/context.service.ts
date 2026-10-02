import { Like, type DataSource } from 'typeorm'
import { todayKey } from '@shared/tasks'
import {
  openChecklist,
  type DocFile,
  type NoteEntity,
  type Overview,
  type Refs,
  type SearchHit
} from '@shared/consultora'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { StageModel } from '../models/stage.model'
import { ContactModel } from '../models/contact.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { now, requiredText } from './fields'
import { brief, openActionItems } from './meeting.helpers'
import { listDocuments, readDocument } from './documents'
import type { ClientService } from './client.service'

/**
 * Lecturas que cruzan módulos, pensadas para Claude: panorama, búsqueda, documentos y notas rápidas.
 */
export class ContextService {
  constructor(
    private readonly db: DataSource,
    private readonly clients: ClientService
  ) {}

  /** Todo el negocio en una respuesta: clientes activos y sus proyectos, pendientes, pipeline y últimas reuniones. */
  async overview(): Promise<Overview> {
    const clients = await this.db
      .getRepository(ClientModel)
      .find({ where: { status: 'activo' }, order: { name: 'ASC' } })
    const projects = await this.db
      .getRepository(ProjectModel)
      .find({ order: { updatedAt: 'DESC' } })
    const meetings = await this.db.getRepository(MeetingModel).find({ order: { date: 'DESC' } })
    const stages = await this.db.getRepository(StageModel).find({ order: { position: 'ASC' } })
    const prospects = await this.db.getRepository(ProspectModel).find()

    const openStages = new Set(stages.filter((s) => s.kind === 'open').map((s) => s.id))

    return {
      activeClients: clients.map((client) => {
        const last = meetings.find((m) => m.clientId === client.id)
        return {
          id: client.id,
          name: client.name,
          projects: projects
            .filter((p) => p.clientId === client.id && p.status !== 'cerrado')
            .map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              openDeliverables: openChecklist(p.deliverablesMd).length
            })),
          lastMeeting: last ? { id: last.id, date: last.date, title: last.title } : null
        }
      }),
      openActionItems: openActionItems(meetings).slice(0, 40),
      pipeline: stages.map((stage) => {
        const list = prospects.filter((p) => p.stageId === stage.id)
        return {
          stage: stage.name,
          kind: stage.kind,
          count: list.length,
          valueUsd: list.reduce((t, p) => t + (p.valueUsd ?? 0), 0)
        }
      }),
      nextSteps: prospects
        .filter((p) => openStages.has(p.stageId) && p.nextStep)
        .sort((a, b) => (a.nextStepDate ?? '9999').localeCompare(b.nextStepDate ?? '9999'))
        .map((p) => ({
          prospectId: p.id,
          company: p.company,
          nextStep: p.nextStep!,
          date: p.nextStepDate
        })),
      recentMeetings: meetings.slice(0, 5).map(brief)
    }
  }

  /** Nombres para selectores. */
  async refs(): Promise<Refs> {
    const clients = await this.db.getRepository(ClientModel).find({ order: { name: 'ASC' } })
    const projects = await this.db.getRepository(ProjectModel).find({ order: { name: 'ASC' } })
    const prospects = await this.db.getRepository(ProspectModel).find({ order: { company: 'ASC' } })
    return {
      clients: clients.map(({ id, name, status }) => ({ id, name, status })),
      projects: projects.map(({ id, name, clientId, status }) => ({ id, name, clientId, status })),
      prospects: prospects.map(({ id, company, clientId }) => ({ id, company, clientId }))
    }
  }

  /** Busca texto en clientes, proyectos, reuniones (incluida la transcripción) y prospectos. */
  async search(query: string): Promise<SearchHit[]> {
    const q = requiredText(query, 'La búsqueda', 200)
    const like = Like(`%${q}%`)

    const clients = await this.db
      .getRepository(ClientModel)
      .find({ where: [{ name: like }, { notesMd: like }, { contactsMd: like }, { sector: like }] })
    const projects = await this.db.getRepository(ProjectModel).find({
      where: [{ name: like }, { objectiveMd: like }, { deliverablesMd: like }, { notesMd: like }]
    })
    const meetings = await this.db.getRepository(MeetingModel).find({
      where: [
        { title: like },
        { summaryMd: like },
        { decisionsMd: like },
        { rawNotesMd: like },
        { transcriptMd: like }
      ],
      order: { date: 'DESC' }
    })
    const prospects = await this.db.getRepository(ProspectModel).find({
      where: [{ company: like }, { notesMd: like }, { contactMd: like }, { nextStep: like }]
    })

    const contacts = await this.db
      .getRepository(ContactModel)
      .find({ where: [{ name: like }, { email: like }, { role: like }, { notesMd: like }] })

    return [
      ...contacts.map((c) => hit('contact', c.id, c.name, q, [c.name, c.role, c.email, c.notesMd])),
      ...clients.map((c) =>
        hit('client', c.id, c.name, q, [c.name, c.sector, c.notesMd, c.contactsMd])
      ),
      ...projects.map((p) =>
        hit('project', p.id, p.name, q, [p.name, p.objectiveMd, p.deliverablesMd, p.notesMd])
      ),
      ...meetings.map((m) =>
        hit('meeting', m.id, `${m.date.slice(0, 10)} · ${m.title}`, q, [
          m.title,
          m.summaryMd,
          m.decisionsMd,
          m.rawNotesMd,
          m.transcriptMd
        ])
      ),
      ...prospects.map((p) =>
        hit('prospect', p.id, p.company, q, [p.company, p.notesMd, p.contactMd, p.nextStep])
      )
    ].slice(0, 50)
  }

  async listDocuments(client: string): Promise<DocFile[]> {
    return listDocuments((await this.clients.find(client)).folderPath)
  }

  async readDocument(client: string, path: string): Promise<{ path: string; content: string }> {
    const folder = (await this.clients.find(client)).folderPath
    return { path, content: await readDocument(folder, requiredText(path, 'La ruta', 1000)) }
  }

  /**
   * Añade una nota fechada al final de las notas de un cliente, proyecto, prospecto o reunión:
   * `**2026-10-02** — texto`. La forma más rápida de alimentar contexto.
   */
  async appendNote(entity: NoteEntity, ref: string, text: string): Promise<void> {
    const line = `**${todayKey()}** — ${requiredText(text, 'La nota', 5000)}`
    const add = (md: string): string => (md.trim() ? `${md.trimEnd()}\n\n${line}` : line)

    await transactionGuard(this.db, async (manager) => {
      const stamp = now()
      if (entity === 'client') {
        const repo = manager.getRepository(ClientModel)
        const row = await findByRef(repo, ref, 'name', 'el cliente')
        await repo.save({ ...row, notesMd: add(row.notesMd), updatedAt: stamp })
      } else if (entity === 'project') {
        const repo = manager.getRepository(ProjectModel)
        const row = await findByRef(repo, ref, 'name', 'el proyecto')
        await repo.save({ ...row, notesMd: add(row.notesMd), updatedAt: stamp })
      } else if (entity === 'prospect') {
        const repo = manager.getRepository(ProspectModel)
        const row = await findByRef(repo, ref, 'company', 'el prospecto')
        await repo.save({ ...row, notesMd: add(row.notesMd), updatedAt: stamp })
      } else if (entity === 'meeting') {
        const repo = manager.getRepository(MeetingModel)
        const row = await repo.findOneBy({ id: ref })
        if (!row) throw new AppError('not_found', 'No existe esa reunión.')
        await repo.save({ ...row, rawNotesMd: add(row.rawNotesMd), updatedAt: stamp })
      } else {
        throw new AppError('invalid', 'entity debe ser client, project, prospect o meeting.')
      }
    })
  }
}

/** Resultado de búsqueda con ~160 caracteres alrededor de la primera coincidencia. */
function hit(
  type: SearchHit['type'],
  id: string,
  title: string,
  query: string,
  fields: (string | null)[]
): SearchHit {
  const q = query.toLowerCase()
  const field = fields.find((f) => f?.toLowerCase().includes(q)) ?? ''
  const at = field.toLowerCase().indexOf(q)
  const start = Math.max(0, at - 70)
  const snippet = field
    .slice(start, start + 160)
    .replace(/\s+/g, ' ')
    .trim()
  return {
    type,
    id,
    title,
    snippet: `${start > 0 ? '…' : ''}${snippet}${start + 160 < field.length ? '…' : ''}`
  }
}
