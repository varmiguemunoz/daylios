import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '../atoms/IconButton'
import { useOverlay } from './overlay'

const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Botones al pie, alineados a la derecha. */
  actions?: ReactNode
  size?: keyof typeof WIDTH
}

/** Diálogo centrado (patrón de la hoja de grabación). Foco atrapado; Esc o clic fuera cierra. */
export function Modal({
  open,
  title,
  onClose,
  children,
  actions,
  size = 'md'
}: ModalProps): React.JSX.Element | null {
  const panel = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, panel)
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-6 [-webkit-app-region:no-drag]">
      <div aria-hidden className="ui-backdrop absolute inset-0 bg-night/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`ui-modal toast-in relative flex max-h-[calc(100vh-48px)] w-full ${WIDTH[size]} flex-col rounded-xl bg-surface shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] outline-none`}
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
          <h2 className="ui-panel-title text-title font-extrabold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {actions && (
          <footer className="flex flex-wrap justify-end gap-2 px-6 pb-5">{actions}</footer>
        )}
      </div>
    </div>,
    document.body
  )
}
