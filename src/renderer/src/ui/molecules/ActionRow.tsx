import type { ReactNode } from 'react'

interface ActionRowProps {
  onClick?: () => void
  children: ReactNode
  /** Acciones a la derecha; aparecen al pasar el ratón o con el foco dentro. */
  actions?: ReactNode
  /** Acciones siempre visibles (p. ej. mientras se renombra). */
  pinned?: boolean
}

/** Fila de List con zona clicable y acciones aparte (sin botones dentro de botones). */
export function ActionRow({
  onClick,
  children,
  actions,
  pinned
}: ActionRowProps): React.JSX.Element {
  return (
    <li className="ui-row group flex items-center gap-1 pr-2 transition-colors hover:bg-surface-raised focus-within:bg-surface-raised">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="ui-row-main flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left outline-offset-[-2px]"
        >
          {children}
        </button>
      ) : (
        <div className="ui-row-main flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          {children}
        </div>
      )}
      {actions && (
        <div
          className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
            pinned ? '' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
          }`}
        >
          {actions}
        </div>
      )}
    </li>
  )
}
