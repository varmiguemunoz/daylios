import { randomUUID } from 'crypto'
import { join } from 'path'
import type { DataSource, EntityManager } from 'typeorm'
import {
  CLIENT_STATUSES,
  normalizeName,
  openChecklist,
  type Client,
  type ClientDetail,
  type ClientInput,
  type ClientStatus,
  type Meeting
} from '@shared/consultora'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { transactionGuard } from '../guards/transaction.guard'
import { config } from '../config'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { markdown, now, oneOf, optionalDay, optionalText, requiredText } from './fields'
import { ensureClientFolder, listDocuments, safeFolderName } from './documents'
import { brief, openActionItems } from './meeting.helpers'

/** Clientes: alta (con carpeta de documentos), edición y ficha completa. */
export class ClientService {
  constructor(private readonly db: DataSource) {}

  find(ref: unknown): Promise<Client> {
    return findByRef(this.db.getRepository(ClientModel), ref, 'name', 'el cliente')
  }

  /** Lista con nº de proyectos activos y fecha de la última reunión. */
  async list(
    status?: ClientStatus
  ): Promise<(Client & { activeProjects: number; lastMeetingDate: string | null })[]> {
    const clients = await this.db
      .getRepository(ClientModel)
      .find({ where: status ? { status } : {}, order: { name: 'ASC' } })
    const projects = await this.db.getRepository(ProjectModel).findBy({ status: 'activo' })
    const meetings = await this.db
      .getRepository(MeetingModel)
      .find({ select: { clientId: true, date: true }, order: { date: 'DESC' } })

    return clients.map((client) => ({
      ...client,
      activeProjects: projects.filter((p) => p.clientId === client.id).length,
      lastMeetingDate: meetings.find((m) => m.clientId === client.id)?.date ?? null
    }))
  }

  /** Todo lo que hay de un cliente: proyectos, reuniones, prospectos, action items abiertos y documentos. */
  async get(ref: unknown): Promise<ClientDetail> {
    const client = await this.find(ref)
    const projects = await this.db
      .getRepository(ProjectModel)
      .find({ where: { clientId: client.id }, order: { updatedAt: 'DESC' } })
    const meetings: Meeting[] = await this.db
      .getRepository(MeetingModel)
      .find({ where: { clientId: client.id }, order: { date: 'DESC' } })
    const prospects = await this.db.getRepository(ProspectModel).findBy({ clientId: client.id })

    return {
      ...client,
      projects: projects.map((p) => ({ ...p, openDeliverables: openChecklist(p.deliverablesMd) })),
      meetings: meetings.map(brief),
      prospects,
      openActionItems: openActionItems(meetings),
      documents: await listDocuments(client.folderPath)
    }
  }

  create(input: ClientInput): Promise<Client> {
    return transactionGuard(this.db, (manager) => insertClient(manager, input))
  }

  update(ref: unknown, patch: ClientInput): Promise<Client> {
    return transactionGuard(this.db, async (manager) => {
      const clients = manager.getRepository(ClientModel)
      const client = await findByRef(clients, ref, 'name', 'el cliente')
      if (patch.name !== undefined) client.name = requiredText(patch.name, 'El nombre')
      if (patch.sector !== undefined) client.sector = optionalText(patch.sector, 'El sector')
      if (patch.status !== undefined)
        client.status = oneOf(patch.status, CLIENT_STATUSES, 'El estado')
      if (patch.contactsMd !== undefined)
        client.contactsMd = markdown(patch.contactsMd, 'Contactos')
      if (patch.notesMd !== undefined) client.notesMd = markdown(patch.notesMd, 'Las notas')
      if (patch.signedAt !== undefined)
        client.signedAt = optionalDay(patch.signedAt, 'La fecha de firma')
      if (patch.folderPath !== undefined) {
        client.folderPath = requiredText(patch.folderPath, 'La carpeta', 1000)
        await ensureClientFolder(client.folderPath)
      }
      client.updatedAt = now()
      return clients.save(client)
    })
  }
}

/**
 * Crea un cliente y su carpeta `CLIENTS_DOCS_PATH/<Nombre>/…` dentro de la transacción en curso.
 * Si la carpeta no se puede crear, la transacción se revierte y no queda el cliente a medias.
 * Exportada para que el pipeline (prospecto ganado) cree el cliente en su misma transacción.
 */
export async function insertClient(manager: EntityManager, input: ClientInput): Promise<Client> {
  const clients = manager.getRepository(ClientModel)
  const name = requiredText(input.name, 'El nombre')

  const all = await clients.find({ select: { name: true } })
  if (all.some((c) => normalizeName(c.name) === normalizeName(name))) {
    throw new AppError('invalid', `Ya existe un cliente llamado «${name}».`)
  }

  const stamp = now()
  const client: Client = {
    id: randomUUID(),
    name,
    sector: optionalText(input.sector, 'El sector'),
    status: input.status ? oneOf(input.status, CLIENT_STATUSES, 'El estado') : 'activo',
    contactsMd: markdown(input.contactsMd, 'Contactos'),
    notesMd: markdown(input.notesMd, 'Las notas'),
    signedAt: optionalDay(input.signedAt, 'La fecha de firma') ?? stamp.slice(0, 10),
    folderPath: input.folderPath?.trim() || join(config.docsPath(), safeFolderName(name)),
    createdAt: stamp,
    updatedAt: stamp
  }
  await clients.insert(client)
  await ensureClientFolder(client.folderPath)
  return client
}
