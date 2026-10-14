import { useEffect, useState } from 'react'
import { todayKey } from '@shared/tasks'
import { noteTitle, type Note as NoteModel } from '@shared/notes'
import type { Go } from '../lib'
import { ErrorNote } from '../ui'
import { useGoneRedirect, useScreenTitle } from '../chrome'
import { NoteEditor } from '../../components/NoteEditor'
import { errorMessage, notesApi } from '../../lib/api'

export function Note({
  id,
  go,
  back
}: {
  id: string
  go: Go
  back: () => void
}): React.JSX.Element {
  const [note, setNote] = useState<NoteModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  useScreenTitle(note ? noteTitle(note.body) : null)
  useGoneRedirect(error)

  useEffect(() => {
    notesApi
      .get(id)
      .then(setNote)
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  if (!note)
    return (
      <div className="mx-auto max-w-[808px] px-6 pt-10">
        <ErrorNote message={error} />
      </div>
    )
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <NoteEditor
        key={note.id}
        note={note}
        today={todayKey()}
        variant="document"
        scrollKey={`scroll.note:${note.id}`}
        onBack={back}
        onOpenNote={(noteId) => go({ name: 'note', id: noteId })}
        onOpenClient={(clientId) => go({ name: 'client', id: clientId })}
      />
    </div>
  )
}
