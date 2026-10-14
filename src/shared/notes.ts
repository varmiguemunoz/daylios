import type { DayKey } from './tasks'

export const NOTE_MAX = 100_000

export interface Note {
  id: string

  body: string

  date: DayKey
  createdAt: string

  updatedAt: string

  path?: string
}

export interface NoteBrief {
  id: string
  title: string
  excerpt: string
  date: DayKey
  updatedAt: string
}

export type NoteTargetType = 'note' | 'client'
export interface NoteTarget {
  type: NoteTargetType
  id: string
}

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

export interface NotesApi {
  list(page: number, pageSize: number): Promise<NotesPage>
  get(id: string): Promise<Note>

  view(id: string): Promise<NoteView>

  search(query: string, limit?: number): Promise<NoteBrief[]>

  create(body: string, links?: NoteLinks): Promise<Note>

  update(id: string, body: string, expected?: string): Promise<Note>

  settle(id: string): Promise<Note>

  remove(id: string): Promise<void>
  link(id: string, target: NoteTarget): Promise<NoteView>
  unlink(id: string, target: NoteTarget): Promise<NoteView>
}

export function noteBrief(n: Note): NoteBrief {
  return {
    id: n.id,
    title: noteTitle(n.body),
    excerpt: noteExcerpt(n.body),
    date: n.date,
    updatedAt: n.updatedAt
  }
}

export function noteTitle(body: string): string {
  const first = textLines(body)[0]
  return first ? first.slice(0, 120) : 'Sin título'
}

export function noteExcerpt(body: string): string {
  return textLines(body).slice(1).join(' ').slice(0, 160)
}

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

export type VoiceResult =
  | { status: 'created'; title: string; noteId: string }
  | { status: 'ignored' }
  | { status: 'failed'; message: string }

export function noteFileName(body: string): string {
  const title = body.trim() ? noteTitle(body) : 'Sin título'
  return (
    title
      .replace(/[/:\\*?"<>|]/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 100)
      .trim() || 'Sin título'
  )
}

const FIRST_LINE = /^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?)(.*)$/

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
