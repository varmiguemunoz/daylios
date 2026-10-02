import { randomUUID } from 'crypto'
import type { DataSource, Repository } from 'typeorm'
import { todayKey } from '@shared/tasks'
import { NOTE_MAX, type Note, type NotesApi, type NotesPage } from '@shared/notes'
import { NoteModel } from '../models/note.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { pageByDay } from './page-by-day'

type Notes = Repository<Note>

/**
 * Notas en markdown. La usan la UI (IPC) y Claude (HTTP).
 * Lecturas: repositorio normal. Escrituras: siempre dentro de `write()` (transacción).
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

  /** Puede crearse vacía: la UI la crea al pulsar «Nueva» y la borra si sale sin escribir. */
  async create(body: string): Promise<Note> {
    const text = checkBody(body)
    return this.write(async (notes) => {
      const now = new Date().toISOString()
      const note: Note = {
        id: randomUUID(),
        body: text,
        date: todayKey(),
        createdAt: now,
        updatedAt: now
      }
      await notes.insert(note)
      return note
    })
  }

  async update(id: string, body: string): Promise<Note> {
    const text = checkBody(body)
    return this.write(async (notes) => {
      const note = await findOrFail(notes, id)
      if (note.body === text) return note
      note.body = text
      note.updatedAt = new Date().toISOString()
      return notes.save(note)
    })
  }

  async remove(id: string): Promise<void> {
    await this.write(async (notes) => {
      await findOrFail(notes, id)
      await notes.delete({ id })
    })
  }

  // ---- internos ----

  private notes(): Notes {
    return this.db.getRepository(NoteModel)
  }

  /** Ejecuta la escritura dentro del guard: si algo falla, se revierte todo. */
  private write<T>(work: (notes: Notes) => Promise<T>): Promise<T> {
    return transactionGuard(this.db, (manager) => work(manager.getRepository(NoteModel)))
  }
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
