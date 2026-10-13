import { useCallback, useEffect, useState } from 'react'
import type { DayKey } from '@shared/tasks'
import type { Note, NoteBrief, NoteTarget } from '@shared/notes'
import { errorMessage, notesApi } from '../lib/api'
import { relativeDay, timeOf } from '../lib/format'
import { useAutosave } from '../lib/useAutosave'
import { BackButton } from './BackButton'
import { MarkdownEditor, fromMarkdownEditor } from './MarkdownEditor'
import { RelatedChips } from './RelatedChips'
import { RelatedNotesSection } from './RelatedNotesSection'
import { NotePicker } from './NotePicker'
import { ConfirmButton, isOverlayOpen } from '../ui'

interface NoteEditorProps {
  note: Note
  today: DayKey
  onBack: () => void
  /** Texto del botón Atrás. */
  backLabel?: string
  /** Abrir una nota relacionada (la navegación la decide la ventana). */
  onOpenNote: (id: string) => void
  /** Abrir un cliente relacionado. */
  onOpenClient: (id: string) => void
}

/**
 * Editor de una nota a pantalla completa. Guarda solo mientras escribes.
 * Arriba y abajo, el índice de notas y clientes relacionados.
 * Al volver: si la nota quedó vacía, se borra; si no, se guarda lo pendiente.
 */
export function NoteEditor({
  note,
  today,
  onBack,
  backLabel = 'Notas',
  onOpenNote,
  onOpenClient
}: NoteEditorProps): React.JSX.Element {
  const [body, setBody] = useState(note.body)
  const [error, setError] = useState<string | null>(null)
  const [related, setRelated] = useState<NoteBrief[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [picking, setPicking] = useState(false)
  const id = note.id

  const applyView = useCallback(
    (v: { related: NoteBrief[]; clients: { id: string; name: string }[] }) => {
      setRelated(v.related)
      setClients(v.clients)
    },
    []
  )

  useEffect(() => {
    notesApi
      .view(id)
      .then(applyView)
      .catch(() => undefined)
  }, [id, applyView])

  const save = useCallback((text: string) => notesApi.update(id, text), [id])
  const { status, flush } = useAutosave(body, save)

  const back = useCallback(async () => {
    if (body.trim()) await flush()
    else await notesApi.remove(id).catch(() => undefined)
    onBack()
  }, [body, flush, id, onBack])

  // Esc vuelve atrás (guardando antes). En captura: la ventana no debe procesar el mismo Esc otra vez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || isOverlayOpen() || fromMarkdownEditor(e)) return
      e.stopPropagation()
      void back()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [back])

  /** Guarda antes de salir hacia otra nota o cliente. */
  const leaveTo = async (open: () => void): Promise<void> => {
    if (body.trim()) await flush()
    open()
  }

  const relate = async (target: NoteTarget): Promise<void> => {
    setPicking(false)
    try {
      if (!body.trim()) return setError('Escribe algo antes de relacionar la nota.')
      await flush()
      applyView(await notesApi.link(id, target))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const unrelate = async (target: NoteTarget): Promise<void> => {
    try {
      applyView(await notesApi.unlink(id, target))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  /** Borrar (el ConfirmButton ya pidió confirmación). */
  const remove = async (): Promise<void> => {
    try {
      await notesApi.remove(id)
      onBack()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-5">
        <BackButton label={backLabel} onClick={() => void back()} />
        <span className="min-w-0 truncate text-caption text-milk-soft">
          {relativeDay(note.date, today)} · {timeOf(note.createdAt)}
        </span>
        <ConfirmButton label="Borrar nota" onConfirm={() => void remove()} />
      </header>

      {error && (
        <p
          role="alert"
          className="mx-6 mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral"
        >
          {error}
        </p>
      )}

      <div className="px-6 pt-3 empty:hidden">
        <RelatedChips
          notes={related}
          clients={clients}
          onOpenNote={(noteId) => void leaveTo(() => onOpenNote(noteId))}
          onOpenClient={(clientId) => void leaveTo(() => onOpenClient(clientId))}
        />
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <MarkdownEditor
          value={body}
          onChange={setBody}
          status={status}
          placeholder={'# Título\n\nEscribe en markdown…'}
          emptyHint="Nota vacía. Clic para escribir."
          onCommit={flush}
          autoEdit={!note.body.trim()}
        />
      </div>

      <RelatedNotesSection
        notes={related}
        onOpen={(noteId) => void leaveTo(() => onOpenNote(noteId))}
        onUnlink={(noteId) => void unrelate({ type: 'note', id: noteId })}
        onAdd={() => setPicking(true)}
      />
      {clients.length > 0 && (
        <p className="-mt-2 px-6 pb-4 text-micro font-semibold text-milk-soft">
          Clientes:{' '}
          {clients.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <button
                type="button"
                className="hover:text-milk"
                onClick={() => void leaveTo(() => onOpenClient(c.id))}
              >
                {c.name}
              </button>{' '}
              <button
                type="button"
                aria-label={`Quitar relación con ${c.name}`}
                className="text-milk-faint hover:text-rose"
                onClick={() => void unrelate({ type: 'client', id: c.id })}
              >
                ×
              </button>
            </span>
          ))}
        </p>
      )}

      <NotePicker
        open={picking}
        noteId={id}
        exclude={[...related.map((n) => n.id), ...clients.map((c) => c.id)]}
        onPick={(target) => void relate(target)}
        onClose={() => setPicking(false)}
      />
    </div>
  )
}
