import type { DayKey } from './tasks'

/** Máximo de caracteres por nota. */
export const NOTE_MAX = 100_000

export interface Note {
  id: string
  /** Contenido completo en markdown. El título es su primera línea (ver `noteTitle`). */
  body: string
  /** Día de creación (YYYY-MM-DD local). Agrupa la lista. */
  date: DayKey
  createdAt: string
  updatedAt: string
}

export interface NotesDay {
  date: DayKey
  notes: Note[]
}

export interface NotesPage {
  days: NotesDay[]
  page: number
  totalPages: number
  totalDays: number
  totalNotes: number
}

/** Contrato que la UI consume (vía IPC) y que implementa NoteService. */
export interface NotesApi {
  list(page: number, pageSize: number): Promise<NotesPage>
  get(id: string): Promise<Note>
  create(body: string): Promise<Note>
  update(id: string, body: string): Promise<Note>
  remove(id: string): Promise<void>
}

/** Primera línea con texto, sin marcas de markdown. */
export function noteTitle(body: string): string {
  const first = textLines(body)[0]
  return first ? first.slice(0, 120) : 'Sin título'
}

/** Resto del texto en una sola línea, para la lista. */
export function noteExcerpt(body: string): string {
  return textLines(body).slice(1).join(' ').slice(0, 160)
}

/** Líneas con texto, quitando #, >, viñetas, casillas, énfasis y enlaces. Ignora bloques ```. */
function textLines(body: string): string[] {
  return body
    .split('\n')
    .filter((line) => !line.trim().startsWith('```'))
    .map((line) =>
      line
        .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_~`|]/g, '')
        .trim()
    )
    .filter(Boolean)
}

/** Resultado de una nota de voz. */
export type VoiceResult =
  | { status: 'created'; title: string; noteId: string }
  | { status: 'ignored' }
  | { status: 'failed'; message: string }
