import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { renderPage } from './pdf'

export const PdfPage = memo(function PdfPage({
  doc,
  number,
  resolution,
  lazy = false,
  onRendered
}: {
  doc: PDFDocumentProxy
  number: number
  resolution: number
  lazy?: boolean
  onRendered?: (canvas: HTMLCanvasElement) => void
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(!lazy)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (near || !canvas.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(canvas.current)
    return () => observer.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let alive = true
    let task: RenderTask | null = null
    void doc
      .getPage(number)
      .then((page) => {
        if (!alive || !canvas.current) return
        task = renderPage(page, canvas.current, resolution)
        return task.promise.then(() => {
          if (!alive || !canvas.current) return
          setDrawn(true)
          onRendered?.(canvas.current)
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
      task?.cancel()
    }
  }, [doc, number, resolution, near, onRendered])

  return (
    <canvas
      ref={canvas}
      aria-label={`Página ${number}`}
      className="block h-auto w-full bg-white"
      style={drawn ? undefined : { aspectRatio: '1 / 1.294' }}
    />
  )
})
