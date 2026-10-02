import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { DayKey } from '@shared/tasks'
import { noteExcerpt, noteTitle, type Note, type NotesPage } from '@shared/notes'
import { notesApi, onDataChanged } from '../lib/api'
import { plural, relativeDay, timeOf } from '../lib/format'
import { DayHeading } from './DayHeading'
import { Pager } from './Pager'

const PAGE_SIZE = 7

interface NotesViewProps {
  today: DayKey
  onOpen: (note: Note) => void
  onCreate: () => void
}

/** Todas las notas por día, de la más reciente a la más antigua. Mismo esqueleto que Historial. */
export function NotesView({ today, onOpen, onCreate }: NotesViewProps): React.JSX.Element {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<NotesPage | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await notesApi.list(page, PAGE_SIZE))
      setError(false)
    } catch {
      setError(true)
    }
  }, [page])

  // Cargar al montar, al cambiar de página y cuando Claude cambia notas.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void load()
    return onDataChanged(() => void load())
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-6">
        <h1 className="text-headline font-extrabold">Notas</h1>
        <button
          type="button"
          onClick={onCreate}
          title="Nueva nota (⌘N)"
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nueva
        </button>
      </header>

      <main className="scroll-area fade-bottom mt-5 min-h-0 flex-1 overflow-y-auto pb-6 pl-6">
        {error && (
          <p role="alert" className="rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            No pude cargar las notas. Vuelve a abrir la ventana para reintentar.
          </p>
        )}

        {data && data.totalNotes === 0 && !error && (
          <div className="px-1 pt-2">
            <p className="text-label font-bold">Aún no hay notas.</p>
            <p className="mt-1 text-caption text-milk-soft">
              Pulsa «Nueva» o ⌘N. Escribe en markdown: la primera línea es el título.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          {data?.days.map(({ date, notes }) => (
            <section key={date} aria-label={relativeDay(date, today)}>
              <DayHeading
                aside={
                  <span className="text-caption font-bold text-milk-soft">
                    {plural(notes.length, 'nota', 'notas')}
                  </span>
                }
              >
                {relativeDay(date, today)}
              </DayHeading>
              <ul className="overflow-hidden rounded-md bg-surface">
                {notes.map((note, i) => (
                  <li
                    key={note.id}
                    className={i > 0 ? 'shadow-[inset_0_1px_0_var(--color-hairline)]' : ''}
                  >
                    <NoteItem note={note} onOpen={() => onOpen(note)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  )
}

function NoteItem({ note, onOpen }: { note: Note; onOpen: () => void }): React.JSX.Element {
  const title = noteTitle(note.body)
  const excerpt = noteExcerpt(note.body)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors outline-offset-[-2px] hover:bg-surface-raised focus-visible:bg-surface-raised"
    >
      <span className="flex w-full items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-list font-bold text-milk" title={title}>
          {title}
        </span>
        <span className="shrink-0 text-micro font-semibold text-milk-soft">
          {timeOf(note.updatedAt)}
        </span>
      </span>
      {excerpt && <span className="truncate text-caption text-milk-soft">{excerpt}</span>}
    </button>
  )
}
