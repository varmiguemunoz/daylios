import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function SidePanel({
  title,
  onClose,
  children,
  footer
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}): React.JSX.Element {
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select'))
        onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-ob-border bg-ob-bg">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ob-border px-3">
        <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ob-text">
          {title}
        </div>
        <button
          type="button"
          aria-label="Cerrar panel"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-active hover:text-ob-text"
        >
          <X size={15} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
      {footer && (
        <footer className="flex shrink-0 items-center gap-1.5 border-t border-ob-border px-3 py-2.5">
          {footer}
        </footer>
      )}
    </aside>
  )
}

export function PanelField({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-ob-muted">{label}</span>
      {children}
    </div>
  )
}
