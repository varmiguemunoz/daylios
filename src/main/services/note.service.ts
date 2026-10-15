import { randomUUID } from 'crypto'
import { In, Raw, type DataSource, type EntityManager } from 'typeorm'
import { toDayKey } from '@shared/tasks'
import { normalizeName } from '@shared/consultora'
import { QUICK_NOTES } from '@shared/workspace'
import {
  NOTE_MAX,
  noteBrief,
  noteFileName,
  type Note,
  type ClientNote,
  type NoteBrief,
  type NoteLinks,
  type NoteTarget,
  type NoteTargetType,
  type NoteView,
  type NotesApi,
  type NotesPage
} from '@shared/notes'
import { NoteRelationModel } from '../models/note-relation.model'
import { ClientModel } from '../models/client.model'
import { WorkspaceItemModel, type WorkspaceRow } from '../models/workspace.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { pageByDay } from './page-by-day'
import type { WorkspaceService } from './workspace.service'

export function toNote(row: WorkspaceRow): Note {
  return {
    id: row.id,
    body: row.text ?? '',
    date: toDayKey(new Date(row.createdAt)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    path: row.path
  }
}

export class NoteService implements NotesApi {
  constructor(
    private readonly db: DataSource,
    private readonly workspace: WorkspaceService
  ) {}

  async list(page: number, pageSize: number): Promise<NotesPage> {
    const quick = await this.workspace.quickNotesFolder()
    const notes = (await this.workspace.noteRows(quick.id))
      .map(toNote)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    const { days, ...pages } = pageByDay(notes, page, pageSize)
    return {
      ...pages,
      days: days.map(({ date, items }) => ({ date, notes: items })),
      totalNotes: notes.length
    }
  }

  async get(id: string): Promise<Note> {
    return toNote(await this.workspace.noteRow(id))
  }

  async view(id: string): Promise<NoteView> {
    return viewOf(this.db.manager, toNote(await this.workspace.noteRow(id)))
  }

  async search(query: string, limit = 20): Promise<NoteBrief[]> {
    const q = normalizeName(typeof query === 'string' ? query : '')
    const max = Math.max(1, Math.min(Number(limit) || 20, 50))
    const notes = (await this.workspace.noteRows()).map(toNote)
    return notes
      .filter((n) => n.body.trim() && (!q || normalizeName(n.body).includes(q)))
      .slice(0, max)
      .map(noteBrief)
  }

  async create(body: string, links: NoteLinks = {}): Promise<Note> {
    const text = checkBody(body)
    await this.workspace.quickNotesFolder()
    const row = await this.workspace.createNoteAt(QUICK_NOTES, noteFileName(text), text)
    if (links.notes?.length || links.clients?.length) {
      await transactionGuard(this.db, async (manager) => {
        for (const id of links.notes ?? []) await linkNotes(manager, row.id, { type: 'note', id })
        for (const id of links.clients ?? [])
          await linkNotes(manager, row.id, { type: 'client', id })
      })
    }
    return toNote(row)
  }

  async update(id: string, body: string, expected?: string): Promise<Note> {
    return toNote(await this.workspace.writeNote(id, checkBody(body), expected))
  }

  async settle(id: string): Promise<Note> {
    const row = await this.workspace.noteRow(id)
    if (!row.text?.trim()) return toNote(row)
    return toNote(await this.workspace.renameNoteFile(id, noteFileName(row.text)))
  }

  async remove(id: string): Promise<void> {
    await this.workspace.noteRow(id)
    await transactionGuard(this.db, async (manager) => {
      await removeRelationsOf(manager, 'note', id)
      await manager.getRepository(NoteRelationModel).delete({ noteId: id })
    })
    await this.workspace.remove(id)
  }

  async link(id: string, target: NoteTarget): Promise<NoteView> {
    const note = toNote(await this.workspace.noteRow(id))
    return transactionGuard(this.db, async (manager) => {
      await linkNotes(manager, note.id, target)
      return viewOf(manager, note)
    })
  }

  async unlink(id: string, target: NoteTarget): Promise<NoteView> {
    const note = toNote(await this.workspace.noteRow(id))
    return transactionGuard(this.db, async (manager) => {
      const t = checkTarget(target)
      const [noteId, targetId] = t.type === 'note' ? ordered(note.id, t.id) : [note.id, t.id]
      await manager
        .getRepository(NoteRelationModel)
        .delete({ noteId, targetType: t.type, targetId })
      return viewOf(manager, note)
    })
  }
}

// ---- ayudantes (exportados los que usan otros servicios en su transacción) ----

async function notesByIds(manager: EntityManager, ids: string[]): Promise<Note[]> {
  if (!ids.length) return []
  const rows = await manager
    .getRepository(WorkspaceItemModel)
    .find({ where: { id: In(ids), kind: 'note' }, order: { updatedAt: 'DESC' } })
  return rows.map(toNote)
}

export async function notesOfClient(
  manager: EntityManager,
  clientId: string,
  folder: string | null = null
): Promise<ClientNote[]> {
  const links = await manager
    .getRepository(NoteRelationModel)
    .findBy({ targetType: 'client', targetId: clientId })
  const manual = (
    await notesByIds(
      manager,
      links.map((l) => l.noteId)
    )
  ).map(noteBrief)
  const inFolder = folder
    ? await manager.getRepository(WorkspaceItemModel).find({
        where: {
          kind: 'note',
          path: Raw((p) => `${p} >= :lo AND ${p} < :hi`, { lo: `${folder}/`, hi: `${folder}0` })
        },
        order: { updatedAt: 'DESC' }
      })
    : []
  const linked = new Set(manual.map((n) => n.id))
  return [
    ...manual.map((n) => ({ ...n, origin: 'manual' as const })),
    ...inFolder
      .filter((row) => !linked.has(row.id))
      .map((row) => ({ ...noteBrief(toNote(row)), origin: 'folder' as const }))
  ]
}

export async function removeRelationsOf(
  manager: EntityManager,
  type: NoteTargetType,
  id: string
): Promise<void> {
  await manager.getRepository(NoteRelationModel).delete({ targetType: type, targetId: id })
}

async function linkNotes(
  manager: EntityManager,
  noteId: string,
  target: NoteTarget
): Promise<void> {
  const t = checkTarget(target)
  if (t.type === 'note') {
    if (t.id === noteId) throw new AppError('invalid', 'Una nota no se relaciona consigo misma.')
    if (!(await manager.getRepository(WorkspaceItemModel).findOneBy({ id: t.id, kind: 'note' }))) {
      throw new AppError('not_found', 'No existe esa nota.')
    }
  } else if (!(await manager.getRepository(ClientModel).findOneBy({ id: t.id }))) {
    throw new AppError('not_found', 'No existe ese cliente.')
  }
  const [a, b] = t.type === 'note' ? ordered(noteId, t.id) : [noteId, t.id]
  const repo = manager.getRepository(NoteRelationModel)
  if (await repo.findOneBy({ noteId: a, targetType: t.type, targetId: b })) return
  await repo.insert({
    id: randomUUID(),
    noteId: a,
    targetType: t.type,
    targetId: b,
    createdAt: new Date().toISOString()
  })
}

async function viewOf(manager: EntityManager, note: Note): Promise<NoteView> {
  const repo = manager.getRepository(NoteRelationModel)
  const asNote = await repo.findBy({ noteId: note.id })
  const asTarget = await repo.findBy({ targetType: 'note', targetId: note.id })
  const relatedIds = [
    ...asNote.filter((r) => r.targetType === 'note').map((r) => r.targetId),
    ...asTarget.map((r) => r.noteId)
  ]
  const clientIds = asNote.filter((r) => r.targetType === 'client').map((r) => r.targetId)
  const related = await notesByIds(manager, relatedIds)
  const clients = clientIds.length
    ? await manager
        .getRepository(ClientModel)
        .find({ where: { id: In(clientIds) }, order: { name: 'ASC' } })
    : []
  return {
    note,
    related: related.map(noteBrief),
    clients: clients.map((c) => ({ id: c.id, name: c.name }))
  }
}

const ordered = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])

function checkTarget(value: unknown): NoteTarget {
  const t = value as NoteTarget
  if (!t || (t.type !== 'note' && t.type !== 'client') || typeof t.id !== 'string' || !t.id) {
    throw new AppError('invalid', 'La relación debe ser { type: "note" | "client", id }.')
  }
  return t
}

function checkBody(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('invalid', 'La nota debe ser texto.')
  if (value.length > NOTE_MAX) {
    throw new AppError('invalid', `La nota no puede pasar de ${NOTE_MAX} caracteres.`)
  }
  return value
}
