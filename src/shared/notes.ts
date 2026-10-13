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
  /** Versión en disco: pásala a `update` para no pisar cambios hechos fuera de la app. */
  updatedAt: string
  /** Ruta en la bóveda del workspace («Notas rápidas/2026-10-13 Idea.md»). */
  path?: string
}

/** Nota en listas (relacionadas, buscador, ficha de cliente). */
export interface NoteBrief {
  id: string
  title: string
  excerpt: string
  date: DayKey
  updatedAt: string
}

/** Con qué se puede relacionar una nota. */
export type NoteTargetType = 'note' | 'client'
export interface NoteTarget {
  type: NoteTargetType
  id: string
}

/** Nota con sus relaciones (índice al inicio y al final del editor). */
export interface NoteView {
  note: Note
  related: NoteBrief[]
  clients: { id: string; name: string }[]
}

export interface NoteLinks {
  notes?: string[]
  clients?: string[]
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
  /** Nota con notas y clientes relacionados. */
  view(id: string): Promise<NoteView>
  /** Busca por título y texto (para relacionar). */
  search(query: string, limit?: number): Promise<NoteBrief[]>
  /** Puede nacer ya relacionada (p. ej. «Nueva nota» desde un cliente). */
  create(body: string, links?: NoteLinks): Promise<Note>
  /** `expected` = `updatedAt` que tenía la UI; si el archivo cambió fuera, error de conflicto. */
  update(id: string, body: string, expected?: string): Promise<Note>
  /** Al salir del editor: una nota de «Notas rápidas» renombra su archivo según su título. */
  settle(id: string): Promise<Note>
  /** Borra la nota y sus relaciones. */
  remove(id: string): Promise<void>
  link(id: string, target: NoteTarget): Promise<NoteView>
  unlink(id: string, target: NoteTarget): Promise<NoteView>
}

/** Nota → NoteBrief. */
export function noteBrief(n: Note): NoteBrief {
  return {
    id: n.id,
    title: noteTitle(n.body),
    excerpt: noteExcerpt(n.body),
    date: n.date,
    updatedAt: n.updatedAt
  }
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

/** Nombre de archivo de una nota: su título, sin caracteres que macOS no acepta. Vacía = «Sin título». */
export function noteFileName(body: string): string {
  const title = body.trim() ? noteTitle(body) : 'Sin título'
  return title.replace(/[/:\\*?"<>|]/g, '-').replace(/^\.+/, '').slice(0, 100).trim() || 'Sin título'
}

/** Prefijo de markdown de la primera línea (`# `, `> `, viñeta…) y su texto. */
const FIRST_LINE = /^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?)(.*)$/

/**
 * Pone `title` como título de la nota (su primera línea con texto), conservando si era `# `, cita…
 * Sin texto, la nota empieza con `# título`. Así renombrar el archivo y el título nunca se separan.
 */
export function setNoteTitle(body: string, title: string): string {
  const lines = body.split('\n')
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      fence = !fence
      continue
    }
    if (fence || !line.trim()) continue
    const m = FIRST_LINE.exec(line)
    lines[i] = `${m?.[1] ?? ''}${title}`
    return lines.join('\n')
  }
  return body.trim() ? `# ${title}\n\n${body}` : `# ${title}\n\n`
}
