import { useCallback, useEffect, useRef, useState } from 'react'
import { isOverlayOpen } from '../../ui'
import type { DocContent } from '@shared/consultora'
import { api } from '../lib'
import { ErrorNote } from '../ui'
import { BackButton } from '../../components/BackButton'
import { MarkdownEditor, fromMarkdownEditor } from '../../components/MarkdownEditor'
import { useAutosave } from '../../lib/useAutosave'
import { errorMessage } from '../../lib/api'

/** Editar un documento de texto de la carpeta del cliente. Guarda solo mientras escribes. */
export function Document({
  client,
  path,
  back,
  backLabel
}: {
  client: string
  path: string
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const [doc, setDoc] = useState<DocContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .openDocument(client, path)
      .then(setDoc)
      .catch((e) => setError(errorMessage(e)))
  }, [client, path])

  if (!doc)
    return (
      <div className="px-10 pt-6">
        <BackButton label={backLabel} onClick={back} />
        <ErrorNote message={error} />
      </div>
    )
  return <DocumentEditor client={client} doc={doc} back={back} backLabel={backLabel} />
}

function DocumentEditor({
  client,
  doc,
  back,
  backLabel
}: {
  client: string
  doc: DocContent
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const [content, setContent] = useState(doc.content)
  const [error, setError] = useState<string | null>(null)
  const modifiedAt = useRef(doc.modifiedAt)

  const save = useCallback(
    async (text: string) => {
      try {
        const saved = await api.writeDocument(client, doc.path, text, modifiedAt.current)
        modifiedAt.current = saved.modifiedAt
        setError(null)
      } catch (e) {
        setError(errorMessage(e))
        throw e
      }
    },
    [client, doc.path]
  )
  const { status, flush } = useAutosave(content, save)

  const leave = useCallback(async (): Promise<void> => {
    await flush()
    back()
  }, [flush, back])

  // Esc guarda y vuelve (en captura: la ventana no debe procesar el mismo Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || isOverlayOpen() || fromMarkdownEditor(e)) return
      e.stopPropagation()
      void leave()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [leave])

  return (
    <div className="flex h-full flex-col pl-10">
      <header className="flex items-center justify-between gap-3 pt-6 pr-6">
        <BackButton label={backLabel} onClick={() => void leave()} />
      </header>
      <div className="pt-4 pr-6">
        <h1 className="truncate text-headline font-extrabold">{doc.name}</h1>
        <p className="mt-1 truncate text-caption text-milk-soft">{doc.path}</p>
        <ErrorNote message={error} />
      </div>
      <div className="mt-4 -ml-4 flex min-h-0 flex-1 flex-col">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          status={status}
          placeholder="Escribe…"
          emptyHint="Documento vacío. Clic para escribir."
          onCommit={flush}
        />
      </div>
    </div>
  )
}
