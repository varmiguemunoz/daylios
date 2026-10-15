import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Minus, Plus, X } from 'lucide-react'
import { baseName } from '@shared/workspace'
import { useOverlay } from '../../../../ui/organisms/overlay'
import { PdfPage } from './PdfPage'
import { PreviewState } from './PreviewState'
import { usePdf } from './usePdf'

const PAGE_WIDTH = 760
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export function DocPreview({
  path,
  onClose,
  onOpenExternal
}: {
  path: string
  onClose: () => void
  onOpenExternal: () => void
}): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  useOverlay(true, onClose, panel)
  const { doc, status, retry } = usePdf(path, true)
  const [step, setStep] = useState(2)
  const scale = SCALES[step]
  const width = Math.round(PAGE_WIDTH * scale)
  const name = baseName(path)

  return createPortal(
    <div className="fixed inset-0 z-50 flex p-6 [-webkit-app-region:no-drag]">
      <div aria-hidden className="ui-backdrop absolute inset-0 bg-night/70" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        tabIndex={-1}
        onKeyDown={(e) => e.stopPropagation()}
        className="toast-in relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-ob-border bg-ob-alt shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] outline-none"
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ob-border px-3">
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium text-ob-text">{name}</h2>
          {doc && (
            <span className="text-[12px] text-ob-faint tabular-nums">
              {doc.numPages} {doc.numPages === 1 ? 'página' : 'páginas'}
            </span>
          )}
          <button
            type="button"
            aria-label="Alejar"
            title="Alejar"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="ob-tool"
          >
            <Minus size={15} />
          </button>
          <span className="w-10 text-center text-[12px] text-ob-muted tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Acercar"
            title="Acercar"
            disabled={step === SCALES.length - 1}
            onClick={() => setStep(step + 1)}
            className="ob-tool"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            aria-label="Abrir en la app predeterminada"
            title="Abrir en la app predeterminada"
            onClick={onOpenExternal}
            className="ob-tool"
          >
            <ExternalLink size={15} />
          </button>
          <button
            type="button"
            aria-label="Cerrar"
            title="Cerrar · Esc"
            onClick={onClose}
            className="ob-tool"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[#2a2a2a]">
          {status ? (
            <PreviewState status={status} onRetry={retry} onOpenExternal={onOpenExternal} />
          ) : doc ? (
            <div className="mx-auto flex flex-col gap-4 py-6" style={{ width }}>
              {Array.from({ length: doc.numPages }, (_, i) => (
                <PdfPage key={i} doc={doc} number={i + 1} resolution={width} lazy={i > 1} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
