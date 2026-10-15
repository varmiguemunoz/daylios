import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { rename } from 'fs/promises'
import { basename, dirname, join, relative, sep } from 'path'
import { emit } from '../automations/events'
import type { DataSource, EntityManager } from 'typeorm'
import {
  CLIENT_STATUSES,
  normalizeName,
  openChecklist,
  type Client,
  type ClientDetail,
  type ClientInput,
  type ClientStatus,
  type Meeting,
  type ClientImpact
} from '@shared/consultora'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { MeetingModel } from '../models/meeting.model'
import { ContactModel } from '../models/contact.model'
import { NoteRelationModel } from '../models/note-relation.model'
import { afterCommit, transactionGuard } from '../guards/transaction.guard'
import { notesOfClient, removeRelationsOf } from './note.service'
import { moveToTrash } from './trash'
import { config } from '../config'
import { AppError } from './app.error'
import { findByRef } from './ref'
import { markdown, now, oneOf, optionalDay, optionalText, requiredText } from './fields'
import {
  CLIENTS_FOLDER,
  clientFolderFor,
  ensureClientFolder,
  isInside,
  listDocuments
} from './documents'
import { withoutChangeLog } from '../db/author'
import { brief, openActionItems } from './meeting.helpers'
import { unlinkTasks } from './task.service'

export class ClientService {
  constructor(private readonly db: DataSource) {}

  find(ref: unknown): Promise<Client> {
    return findByRef(this.db.getRepository(ClientModel), ref, 'name', 'el cliente')
  }

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

  async get(ref: unknown): Promise<ClientDetail> {
    const client = await this.find(ref)
    const folder = workspaceFolderOf(client.folderPath)
    const projects = await this.db
      .getRepository(ProjectModel)
      .find({ where: { clientId: client.id }, order: { updatedAt: 'DESC' } })
    const meetings: Meeting[] = await this.db
      .getRepository(MeetingModel)
      .find({ where: { clientId: client.id }, order: { date: 'DESC' } })
    const prospects = await this.db.getRepository(ProspectModel).findBy({ clientId: client.id })
    const contacts = await this.db
      .getRepository(ContactModel)
      .find({ where: { clientId: client.id }, order: { name: 'ASC' } })

    return {
      ...client,
      contacts,
      projects: projects.map((p) => ({ ...p, openDeliverables: openChecklist(p.deliverablesMd) })),
      meetings: meetings.map(brief),
      prospects,
      openActionItems: openActionItems(meetings),
      documents: await listDocuments(client.folderPath),
      notes: await notesOfClient(this.db.manager, client.id, folder),
      folder
    }
  }

  async impact(ref: unknown): Promise<ClientImpact> {
    const client = await this.find(ref)
    const m = this.db.manager
    return {
      projects: await m.getRepository(ProjectModel).countBy({ clientId: client.id }),
      meetings: await m.getRepository(MeetingModel).countBy({ clientId: client.id }),
      contacts: await m.getRepository(ContactModel).countBy({ clientId: client.id }),
      prospects: await m.getRepository(ProspectModel).countBy({ clientId: client.id }),
      notes: await m
        .getRepository(NoteRelationModel)
        .countBy({ targetType: 'client', targetId: client.id }),
      folderPath: client.folderPath
    }
  }

  remove(ref: unknown, opts: { trashFolder?: boolean } = {}): Promise<void> {
    return transactionGuard(this.db, async (manager) => {
      const client = await findByRef(manager.getRepository(ClientModel), ref, 'name', 'el cliente')
      await manager.getRepository(ProjectModel).softDelete({ clientId: client.id })
      await manager
        .getRepository(MeetingModel)
        .update({ clientId: client.id }, { clientId: null, projectId: null })
      await manager
        .getRepository(ContactModel)
        .update({ clientId: client.id }, { clientId: null, projectId: null })
      await manager.getRepository(ProspectModel).update({ clientId: client.id }, { clientId: null })
      await removeRelationsOf(manager, 'client', client.id)
      await unlinkTasks(manager, 'client', client.id)
      await manager.getRepository(ClientModel).softDelete({ id: client.id })
      if (opts.trashFolder === true) {
        afterCommit(manager, () => {
          moveToTrash(client.folderPath).catch((e) => console.error('[clientes] papelera', e))
        })
      }
    })
  }

  create(input: ClientInput): Promise<Client> {
    return transactionGuard(this.db, (manager) => insertClient(manager, input))
  }

  async update(ref: unknown, patch: ClientInput): Promise<Client> {
    const current = await this.find(ref)
    const renamed =
      patch.name !== undefined && patch.folderPath === undefined
        ? await renameClientFolder(current, requiredText(patch.name, 'El nombre'))
        : null
    try {
      return await this.save(current.id, patch, renamed)
    } catch (error) {
      if (renamed) await moveFolder(renamed.to, renamed.from).catch(() => undefined)
      throw error
    }
  }

  private save(
    id: string,
    patch: ClientInput,
    renamed: { from: string; to: string } | null
  ): Promise<Client> {
    return transactionGuard(this.db, async (manager) => {
      const clients = manager.getRepository(ClientModel)
      const client = await findByRef(clients, id, 'name', 'el cliente')
      if (patch.name !== undefined) client.name = requiredText(patch.name, 'El nombre')
      if (renamed) {
        client.folderPath = renamed.to
        await repointRecordings(manager, renamed.from, renamed.to)
      }
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

function workspaceFolderOf(folderPath: string): string | null {
  const workspace = config.workspacePath()
  if (!isInside(workspace, folderPath)) return null
  return relative(workspace, folderPath).split(sep).join('/')
}

async function moveFolder(from: string, to: string): Promise<void> {
  if (from.toLowerCase() === to.toLowerCase()) {
    const step = `${to}.renombrando`
    await rename(from, step)
    await rename(step, to)
  } else await rename(from, to)
}

async function renameClientFolder(
  client: Client,
  name: string
): Promise<{ from: string; to: string } | null> {
  const workspace = config.workspacePath()
  const root = join(workspace, CLIENTS_FOLDER)
  const from = client.folderPath
  if (dirname(from) !== root || !existsSync(from)) return null
  const to = clientFolderFor(workspace, name)
  if (to === from) return null
  if (existsSync(to) && to.toLowerCase() !== from.toLowerCase())
    throw new AppError('invalid', `Ya existe una carpeta «${basename(to)}» en Clientes.`)
  await moveFolder(from, to)
  return { from, to }
}

async function repointRecordings(manager: EntityManager, from: string, to: string): Promise<void> {
  const rows: { id: string; recording_path: string }[] = await manager.query(
    'SELECT id, recording_path FROM meetings WHERE recording_path IS NOT NULL'
  )
  await withoutChangeLog(async () => {
    for (const row of rows) {
      if (!row.recording_path.startsWith(from + sep)) continue
      await manager.query('UPDATE meetings SET recording_path = ? WHERE id = ?', [
        to + row.recording_path.slice(from.length),
        row.id
      ])
    }
  })
}

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
    folderPath: input.folderPath?.trim() || clientFolderFor(config.workspacePath(), name),
    createdAt: stamp,
    updatedAt: stamp
  }
  await clients.insert(client)
  await emit(manager, 'client.created', { type: 'client', id: client.id })
  await ensureClientFolder(client.folderPath)
  return client
}
