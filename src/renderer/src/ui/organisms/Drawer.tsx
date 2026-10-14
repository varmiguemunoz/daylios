import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '../atoms/IconButton'
import { useOverlay } from './overlay'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Pie fijo (p. ej. «Limpiar filtros»). */
  footer?: ReactNode
}

/** Panel lateral derecho sobre el contenido. Esc, clic fuera o la X lo cierran. */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer
}: DrawerProps): React.JSX.Element | null {
  const panel = useRef<HTMLElement>(null)
  useOverlay(open, onClose, panel)
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end [-webkit-app-region:no-drag]">
      <div aria-hidden className="ui-backdrop absolute inset-0 bg-night/40" onClick={onClose} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="ui-drawer drawer-in relative flex h-full w-[min(360px,calc(100vw-48px))] flex-col rounded-l-xl bg-surface shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] outline-none"
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 className="ui-panel-title text-title font-extrabold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <footer className="ui-panel-footer px-6 pt-3 pb-5 shadow-[inset_0_1px_0_var(--color-hairline)]">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body
  )
}
