import { noteExcerpt, noteTitle, type Note, type NotesPage } from '@shared/notes'

/** Vista JSON de una nota. Añade `title` y `excerpt` para que Claude no tenga que calcularlos. */
export function noteView(n: Note): Note & { title: string; excerpt: string } {
  return {
    id: n.id,
    title: noteTitle(n.body),
    excerpt: noteExcerpt(n.body),
    body: n.body,
    date: n.date,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt
  }
}

export function notesPageView(p: NotesPage): NotesPage {
  return { ...p, days: p.days.map((d) => ({ date: d.date, notes: d.notes.map(noteView) })) }
}
