import { useCallback, useEffect, useRef, useState } from 'react'
import { isOverlayOpen } from '../../ui'
import type { DocContent } from '@shared/consultora'
import { api } from '../lib'
import { ErrorNote } from '../ui'
import { useGoneRedirect, useScreenTitle } from '../chrome'
import { MarkdownEditor, fromMarkdownEditor } from '../../components/MarkdownEditor'
import { useAutosave } from '../../lib/useAutosave'
import { errorMessage } from '../../lib/api'

export function Document({
  client,
  path,
  back
}: {
  client: string
  path: string
  back: () => void
}): React.JSX.Element {
  const [doc, setDoc] = useState<DocContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  useScreenTitle(doc?.name)
  useGoneRedirect(error)

  useEffect(() => {
    api
      .openDocument(client, path)
      .then(setDoc)
      .catch((e) => setError(errorMessage(e)))
  }, [client, path])

  if (!doc)
    return (
      <div className="mx-auto max-w-[808px] px-6 pt-10">
        <ErrorNote message={error} />
      </div>
    )
  return <DocumentEditor client={client} doc={doc} back={back} />
}

function DocumentEditor({
  client,
  doc,
  back
}: {
  client: string
  doc: DocContent
  back: () => void
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

  // Al salir por la franja (atrás) o por Esc se guarda lo pendiente.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  useEffect(() => () => void flushRef.current(), [])

  // Esc guarda y vuelve (en captura: la ventana no debe procesar el mismo Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || isOverlayOpen() || fromMarkdownEditor(e)) return
      e.stopPropagation()
      void flush().then(back)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [flush, back])

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[808px] flex-col px-6 pt-10 pb-24">
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-[-0.015em] text-ob-text">
          {doc.name}
        </h1>
        <p className="mt-1 truncate text-[13px] text-ob-faint">{doc.path}</p>
        <ErrorNote message={error} />
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            status={status}
            placeholder="Escribe…"
            emptyHint="Documento vacío. Doble clic para escribir."
            onCommit={flush}
          />
        </div>
      </div>
    </div>
  )
}
