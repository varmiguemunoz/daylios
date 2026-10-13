import { useEffect, useState } from 'react'
import { todayKey } from '@shared/tasks'
import type { Note as NoteModel } from '@shared/notes'
import type { Go } from '../lib'
import { ErrorNote } from '../ui'
import { BackButton } from '../../components/BackButton'
import { NoteEditor } from '../../components/NoteEditor'
import { errorMessage, notesApi } from '../../lib/api'

/** Una nota dentro de Consultora: el mismo editor que el menubar, con sus relaciones. */
export function Note({
  id,
  go,
  back,
  backLabel
}: {
  id: string
  go: Go
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const [note, setNote] = useState<NoteModel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    notesApi
      .get(id)
      .then(setNote)
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  if (!note)
    return (
      <div className="px-10 pt-6">
        <BackButton label={backLabel} onClick={back} />
        <ErrorNote message={error} />
      </div>
    )
  return (
    <div className="mx-auto h-full max-w-[920px] pl-4">
      <NoteEditor
        key={note.id}
        note={note}
        today={todayKey()}
        backLabel={backLabel}
        onBack={back}
        onOpenNote={(noteId) => go({ name: 'note', id: noteId })}
        onOpenClient={(clientId) => go({ name: 'client', id: clientId })}
      />
    </div>
  )
}
