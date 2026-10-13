import { useEffect, useState } from 'react'
import { todayKey } from '@shared/tasks'
import type { Note } from '@shared/notes'
import { NoteEditor } from '../../../components/NoteEditor'
import { errorMessage, notesApi } from '../../../lib/api'
import { useWorkspace } from '../context'

/** Una nota del workspace, como en Obsidian: columna de lectura y relaciones al final. */
export function NotePane({ id }: { id: string }): React.JSX.Element {
  const { go } = useWorkspace()
  const [note, setNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    notesApi
      .get(id)
      .then(setNote)
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-[14px] text-ob-faint">
        {error ?? ''}
      </div>
    )
  }
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <NoteEditor
        key={note.id}
        note={note}
        today={todayKey()}
        variant="document"
        onBack={() => go({ name: 'workspace', folder: null })}
        onOpenNote={(noteId) => go({ name: 'ws-note', id: noteId })}
        onOpenClient={(clientId) => go({ name: 'client', id: clientId })}
      />
    </div>
  )
}
