import { useCallback, useEffect, useRef, useState } from 'react'
import type { DayKey } from '@shared/tasks'
import type { Note, NoteBrief, NoteTarget } from '@shared/notes'
import { CONFLICT_MESSAGE, QUICK_NOTES, dirName } from '@shared/workspace'
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
  /**
   * screen = pantalla con Atrás y borrar (menubar, Consultora).
   * document = dentro del workspace, como Obsidian: columna de lectura, sin cabecera; Esc no sale.
   */
  variant?: 'screen' | 'document'
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
  onOpenClient,
  variant = 'screen'
}: NoteEditorProps): React.JSX.Element {
  const documentMode = variant === 'document'
  const [body, setBody] = useState(note.body)
  const [error, setError] = useState<string | null>(null)
  const [related, setRelated] = useState<NoteBrief[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [picking, setPicking] = useState(false)
  const [conflict, setConflict] = useState(false)
  const id = note.id
  /** Versión del archivo que tenemos: si cambió fuera, guardar avisa en vez de pisar. */
  const version = useRef<string | undefined>(note.updatedAt)
  const folder = note.path ? dirName(note.path) : undefined
  // Una nota vacía de «Notas rápidas» se borra al salir; en otras carpetas se respeta.
  const disposable = !note.path || folder === QUICK_NOTES

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

  const save = useCallback(
    async (text: string) => {
      try {
        const saved = await notesApi.update(id, text, version.current)
        version.current = saved.updatedAt
        setConflict(false)
      } catch (e) {
        if (errorMessage(e).includes(CONFLICT_MESSAGE)) setConflict(true)
        throw e
      }
    },
    [id]
  )
  const { status, flush } = useAutosave(body, save)

  /** Guarda lo pendiente y ajusta el nombre del archivo al título (notas rápidas). */
  const settle = useCallback(async () => {
    await flush()
    await notesApi.settle(id).catch(() => undefined)
  }, [flush, id])

  const back = useCallback(async () => {
    if (body.trim()) await settle()
    else if (disposable) await notesApi.remove(id).catch(() => undefined)
    onBack()
  }, [body, settle, disposable, id, onBack])

  /** Conflicto: traer lo que hay en disco… */
  const reloadFromDisk = async (): Promise<void> => {
    try {
      const fresh = await notesApi.get(id)
      version.current = fresh.updatedAt
      setBody(fresh.body)
      setConflict(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  /** …o quedarse con lo de la app y sobrescribir. */
  const keepMine = async (): Promise<void> => {
    try {
      const saved = await notesApi.update(id, body)
      version.current = saved.updatedAt
      setConflict(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  /** Imágenes pegadas: a «Adjuntos» de la bóveda; devuelve su markdown. */
  const attachImages = async (files: File[]): Promise<string[]> => {
    const out: string[] = []
    for (const file of files) {
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        const { link } = await window.api.workspace.attach(id, file.name || 'imagen.png', data)
        out.push(`![](${link})`)
      } catch (e) {
        setError(errorMessage(e))
      }
    }
    return out
  }

  /** Al volver a lectura: guarda y el archivo pasa a llamarse como el título. */
  const commit = useCallback(async () => {
    await flush()
    if (body.trim()) await notesApi.settle(id).catch(() => undefined)
  }, [flush, body, id])

  // Al cambiar de archivo en el workspace el editor se desmonta sin pasar por «Atrás»: se guarda igual.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  }, [commit])
  useEffect(() => () => void commitRef.current(), [])

  // Esc vuelve atrás (guardando antes). En captura: la ventana no debe procesar el mismo Esc otra vez.
  // En el workspace (document) Esc no saca de la nota, como en Obsidian.
  useEffect(() => {
    if (documentMode) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || isOverlayOpen() || fromMarkdownEditor(e)) return
      e.stopPropagation()
      void back()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [back, documentMode])

  /** Guarda antes de salir hacia otra nota o cliente. */
  const leaveTo = async (open: () => void): Promise<void> => {
    if (body.trim()) await settle()
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
    <div
      className={`flex h-full flex-col ${documentMode ? 'mx-auto w-full max-w-[760px] pt-8' : ''}`}
    >
      {!documentMode && (
        <header className="flex items-center justify-between gap-3 px-6 pt-5">
          <BackButton label={backLabel} onClick={() => void back()} />
          <span className="min-w-0 truncate text-caption text-milk-soft">
            {relativeDay(note.date, today)} · {timeOf(note.createdAt)}
          </span>
          <ConfirmButton label="Borrar nota" onConfirm={() => void remove()} />
        </header>
      )}

      {error && (
        <p
          role="alert"
          className="mx-6 mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral"
        >
          {error}
        </p>
      )}

      {conflict && (
        <div
          role="alert"
          className="mx-6 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-butter/10 px-4 py-3 text-caption text-butter"
        >
          <span className="min-w-0 flex-1">
            Esta nota cambió fuera de la app. No guardo nada hasta que elijas.
          </span>
          <button
            type="button"
            onClick={() => void reloadFromDisk()}
            className="h-8 rounded-full bg-surface px-3 font-bold text-milk transition-colors hover:bg-surface-raised"
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={() => void keepMine()}
            className="h-8 rounded-full bg-surface px-3 font-bold text-milk transition-colors hover:bg-surface-raised"
          >
            Guardar mi versión
          </button>
        </div>
      )}

      <div className={`px-6 pt-3 empty:hidden ${documentMode ? 'hidden' : ''}`}>
        <RelatedChips
          notes={related}
          clients={clients}
          onOpenNote={(noteId) => void leaveTo(() => onOpenNote(noteId))}
          onOpenClient={(clientId) => void leaveTo(() => onOpenClient(clientId))}
        />
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${documentMode ? '' : 'mt-5'}`}>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          status={status}
          placeholder={'# Título\n\nEscribe en markdown…'}
          emptyHint="Nota vacía. Clic para escribir."
          onCommit={commit}
          autoEdit={!note.body.trim()}
          imageBase={folder}
          onPasteFiles={note.path ? attachImages : undefined}
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
