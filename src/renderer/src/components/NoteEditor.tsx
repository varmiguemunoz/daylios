import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { DayKey } from '@shared/tasks'
import type { Note } from '@shared/notes'
import { errorMessage, notesApi } from '../lib/api'
import { relativeDay, timeOf } from '../lib/format'
import { useAutosave } from '../lib/useAutosave'
import { BackButton } from './BackButton'
import { MarkdownEditor } from './MarkdownEditor'

interface NoteEditorProps {
  note: Note
  today: DayKey
  onBack: () => void
}

/**
 * Editor de una nota a pantalla completa. Guarda solo mientras escribes.
 * Al volver: si la nota quedó vacía, se borra; si no, se guarda lo pendiente.
 */
export function NoteEditor({ note, today, onBack }: NoteEditorProps): React.JSX.Element {
  const [body, setBody] = useState(note.body)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = note.id

  const save = useCallback((text: string) => notesApi.update(id, text), [id])
  const { status, flush } = useAutosave(body, save)

  const back = useCallback(async () => {
    if (body.trim()) await flush()
    else await notesApi.remove(id).catch(() => undefined)
    onBack()
  }, [body, flush, id, onBack])

  // Esc vuelve a la lista (guardando antes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  /** Borrar en dos pasos: primer clic pide confirmación, segundo borra. */
  const remove = async (): Promise<void> => {
    if (!confirming) return setConfirming(true)
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
        <BackButton label="Notas" onClick={() => void back()} />
        <span className="min-w-0 truncate text-caption text-milk-soft">
          {relativeDay(note.date, today)} · {timeOf(note.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => void remove()}
          onMouseLeave={() => setConfirming(false)}
          onBlur={() => setConfirming(false)}
          aria-label={confirming ? 'Confirmar: borrar nota' : 'Borrar nota'}
          title="Borrar nota"
          className={`flex h-9 shrink-0 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
            confirming
              ? 'bg-rose px-4 text-ink'
              : 'w-9 text-milk-soft hover:bg-rose/15 hover:text-rose'
          }`}
        >
          {confirming ? '¿Borrar?' : <Trash2 size={17} />}
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="mx-6 mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <MarkdownEditor
          value={body}
          onChange={setBody}
          status={status}
          placeholder={'# Título\n\nEscribe en markdown…'}
          emptyHint="Nota vacía. Pulsa Escribir o ⌘E."
        />
      </div>
    </div>
  )
}
