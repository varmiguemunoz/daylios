import { randomUUID } from 'crypto'
import { In, type DataSource, type EntityManager, type Repository } from 'typeorm'
import { todayKey } from '@shared/tasks'
import { normalizeName } from '@shared/consultora'
import {
  NOTE_MAX,
  noteBrief,
  type Note,
  type NoteBrief,
  type NoteLinks,
  type NoteTarget,
  type NoteTargetType,
  type NoteView,
  type NotesApi,
  type NotesPage
} from '@shared/notes'
import { NoteModel } from '../models/note.model'
import { NoteRelationModel } from '../models/note-relation.model'
import { ClientModel } from '../models/client.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { pageByDay } from './page-by-day'

type Notes = Repository<Note>

/**
 * Notas en markdown y sus relaciones (con otras notas y con clientes). La usan la UI (IPC) y Claude (HTTP).
 * Lecturas: repositorio normal. Escrituras: siempre dentro de una transacción.
 */
export class NoteService implements NotesApi {
  constructor(private readonly db: DataSource) {}

  /** Todas las notas por día, de la más reciente a la más antigua, paginadas por días. */
  async list(page: number, pageSize: number): Promise<NotesPage> {
    const notes = await this.notes().find({ order: { date: 'DESC', updatedAt: 'DESC' } })
    const { days, ...pages } = pageByDay(notes, page, pageSize)
    return {
      ...pages,
      days: days.map(({ date, items }) => ({ date, notes: items })),
      totalNotes: notes.length
    }
  }

  async get(id: string): Promise<Note> {
    return findOrFail(this.notes(), id)
  }

  async view(id: string): Promise<NoteView> {
    return viewOf(this.db.manager, await findOrFail(this.notes(), id))
  }

  /** Busca en título y texto, sin distinguir acentos. Vacío = las más recientes. */
  async search(query: string, limit = 20): Promise<NoteBrief[]> {
    const q = normalizeName(typeof query === 'string' ? query : '')
    const max = Math.max(1, Math.min(Number(limit) || 20, 50))
    const notes = await this.notes().find({ order: { updatedAt: 'DESC' } })
    return notes
      .filter((n) => n.body.trim() && (!q || normalizeName(n.body).includes(q)))
      .slice(0, max)
      .map(noteBrief)
  }

  /** Puede crearse vacía (la UI la borra si sale sin escribir) y ya relacionada. */
  async create(body: string, links: NoteLinks = {}): Promise<Note> {
    const text = checkBody(body)
    return this.write(async (manager) => {
      const now = new Date().toISOString()
      const note: Note = { id: randomUUID(), body: text, date: todayKey(), createdAt: now, updatedAt: now }
      await manager.getRepository(NoteModel).insert(note)
      for (const id of links.notes ?? []) await linkNotes(manager, note.id, { type: 'note', id })
      for (const id of links.clients ?? []) await linkNotes(manager, note.id, { type: 'client', id })
      return note
    })
  }

  async update(id: string, body: string): Promise<Note> {
    const text = checkBody(body)
    return this.write(async (manager) => {
      const notes = manager.getRepository(NoteModel)
      const note = await findOrFail(notes, id)
      if (note.body === text) return note
      note.body = text
      note.updatedAt = new Date().toISOString()
      return notes.save(note)
    })
  }

  async remove(id: string): Promise<void> {
    await this.write(async (manager) => {
      await findOrFail(manager.getRepository(NoteModel), id)
      await removeRelationsOf(manager, 'note', id)
      await manager.getRepository(NoteRelationModel).delete({ noteId: id })
      await manager.getRepository(NoteModel).delete({ id })
    })
  }

  async link(id: string, target: NoteTarget): Promise<NoteView> {
    return this.write(async (manager) => {
      const note = await findOrFail(manager.getRepository(NoteModel), id)
      await linkNotes(manager, note.id, target)
      return viewOf(manager, note)
    })
  }

  async unlink(id: string, target: NoteTarget): Promise<NoteView> {
    return this.write(async (manager) => {
      const note = await findOrFail(manager.getRepository(NoteModel), id)
      const t = checkTarget(target)
      const [noteId, targetId] = t.type === 'note' ? ordered(note.id, t.id) : [note.id, t.id]
      await manager.getRepository(NoteRelationModel).delete({ noteId, targetType: t.type, targetId })
      return viewOf(manager, note)
    })
  }

  // ---- internos ----

  private notes(): Notes {
    return this.db.getRepository(NoteModel)
  }

  private write<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return transactionGuard(this.db, work)
  }
}

// ---- ayudantes (exportados los que usan otros servicios en su transacción) ----

/** Notas relacionadas con un cliente, más recientes primero. */
export async function notesOfClient(manager: EntityManager, clientId: string): Promise<NoteBrief[]> {
  const links = await manager.getRepository(NoteRelationModel).findBy({ targetType: 'client', targetId: clientId })
  if (!links.length) return []
  const notes = await manager
    .getRepository(NoteModel)
    .find({ where: { id: In(links.map((l) => l.noteId)) }, order: { updatedAt: 'DESC' } })
  return notes.map(noteBrief)
}

/** Borra las relaciones que apuntan a esa entidad (al borrar un cliente o una nota). */
export async function removeRelationsOf(manager: EntityManager, type: NoteTargetType, id: string): Promise<void> {
  await manager.getRepository(NoteRelationModel).delete({ targetType: type, targetId: id })
}

async function linkNotes(manager: EntityManager, noteId: string, target: NoteTarget): Promise<void> {
  const t = checkTarget(target)
  if (t.type === 'note') {
    if (t.id === noteId) throw new AppError('invalid', 'Una nota no se relaciona consigo misma.')
    await findOrFail(manager.getRepository(NoteModel), t.id)
  } else if (!(await manager.getRepository(ClientModel).findOneBy({ id: t.id }))) {
    throw new AppError('not_found', 'No existe ese cliente.')
  }
  const [a, b] = t.type === 'note' ? ordered(noteId, t.id) : [noteId, t.id]
  const repo = manager.getRepository(NoteRelationModel)
  if (await repo.findOneBy({ noteId: a, targetType: t.type, targetId: b })) return
  await repo.insert({ id: randomUUID(), noteId: a, targetType: t.type, targetId: b, createdAt: new Date().toISOString() })
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
  const related = relatedIds.length
    ? await manager.getRepository(NoteModel).find({ where: { id: In(relatedIds) }, order: { updatedAt: 'DESC' } })
    : []
  const clients = clientIds.length
    ? await manager.getRepository(ClientModel).find({ where: { id: In(clientIds) }, order: { name: 'ASC' } })
    : []
  return { note, related: related.map(noteBrief), clients: clients.map((c) => ({ id: c.id, name: c.name })) }
}

/** Par canónico de una relación nota ↔ nota. */
const ordered = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])

function checkTarget(value: unknown): NoteTarget {
  const t = value as NoteTarget
  if (!t || (t.type !== 'note' && t.type !== 'client') || typeof t.id !== 'string' || !t.id) {
    throw new AppError('invalid', 'La relación debe ser { type: "note" | "client", id }.')
  }
  return t
}

async function findOrFail(notes: Notes, id: unknown): Promise<Note> {
  const note = typeof id === 'string' ? await notes.findOneBy({ id }) : null
  if (!note) throw new AppError('not_found', 'No existe esa nota.')
  return note
}

function checkBody(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('invalid', 'La nota debe ser texto.')
  if (value.length > NOTE_MAX) {
    throw new AppError('invalid', `La nota no puede pasar de ${NOTE_MAX} caracteres.`)
  }
  return value
}
