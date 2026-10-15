import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { ws } from '../../lib'

type PdfLib = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let lib: Promise<PdfLib> | null = null

function pdfjs(): Promise<PdfLib> {
  lib ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]).then(([m, worker]) => {
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  })
  return lib
}

export type PdfLoad =
  | { state: 'ready'; doc: PDFDocumentProxy }
  | { state: 'missing' }
  | { state: 'large'; size: number }
  | { state: 'error'; message: string }

export async function loadPdf(path: string): Promise<PdfLoad> {
  let file: Awaited<ReturnType<typeof ws.fileBytes>>
  try {
    file = await ws.fileBytes(path)
  } catch (error) {
    const message = String((error as Error).message ?? error)
    return /ENOENT|no such file/i.test(message) ? { state: 'missing' } : { state: 'error', message }
  }
  if (!file.data) return { state: 'large', size: file.size }
  try {
    const m = await pdfjs()
    const doc = await m.getDocument({ data: file.data, enableXfa: false }).promise
    return { state: 'ready', doc }
  } catch (error) {
    return { state: 'error', message: String((error as Error).message ?? error) }
  }
}

export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number
): RenderTask {
  const base = page.getViewport({ scale: 1 })
  const scale = (cssWidth / base.width) * window.devicePixelRatio
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  return page.render({ canvas, viewport })
}

const thumbs = new Map<string, string>()
const THUMB_LIMIT = 60

export const thumbOf = (path: string): string | undefined => thumbs.get(path)

export function keepThumb(path: string, canvas: HTMLCanvasElement): void {
  thumbs.delete(path)
  thumbs.set(path, canvas.toDataURL('image/webp', 0.8))
  if (thumbs.size > THUMB_LIMIT) thumbs.delete(thumbs.keys().next().value!)
}

export const megabytes = (bytes: number): string => `${Math.round(bytes / 1048576)} MB`
