import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { loadPdf, megabytes } from './pdf'
import type { PreviewStatus } from './PreviewState'

export function usePdf(
  path: string,
  enabled: boolean
): { doc: PDFDocumentProxy | null; status: PreviewStatus | null; retry: () => void } {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<PreviewStatus | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let loaded: PDFDocumentProxy | null = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga al pedir el archivo
    setStatus({ kind: 'loading' })
    void loadPdf(path).then((result) => {
      if (result.state === 'ready') {
        if (!alive) return void result.doc.loadingTask.destroy()
        loaded = result.doc
        setDoc(result.doc)
        setStatus(null)
        return
      }
      if (!alive) return
      setDoc(null)
      setStatus(
        result.state === 'large'
          ? { kind: 'large', size: megabytes(result.size) }
          : result.state === 'missing'
            ? { kind: 'missing' }
            : { kind: 'error', message: result.message }
      )
    })
    return () => {
      alive = false
      setDoc(null)
      void loaded?.loadingTask.destroy()
    }
  }, [path, enabled, attempt])

  return { doc, status, retry: () => setAttempt((n) => n + 1) }
}
