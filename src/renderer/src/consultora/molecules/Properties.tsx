import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { prefs } from '../workspace/lib'

/**
 * Bloque de propiedades de una nota de Obsidian: encabezado plegable y filas de icono, nombre y
 * valor. Las fichas (cliente, contacto, prospecto, proyecto, reunión) ponen aquí sus datos.
 */
export function Properties({
  children,
  title = 'Propiedades',
  id
}: {
  children: ReactNode
  title?: string
  /** Para recordar si está plegado (una clave por tipo de ficha). */
  id: string
}): React.JSX.Element {
  const key = `props.collapsed.${id}`
  const [collapsed, setCollapsed] = useState(() => prefs.get(key) === '1')
  return (
    <section aria-label={title} className="mt-5 border-b border-ob-border pb-3">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed(!collapsed)
          prefs.set(key, collapsed ? '0' : '1')
        }}
        className="-ml-1 flex h-7 items-center gap-1 rounded-[4px] px-1 text-[13px] font-medium text-ob-muted transition-colors hover:text-ob-text"
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          aria-hidden
        />
        {title}
      </button>
      {!collapsed && <div className="mt-1 flex flex-col">{children}</div>}
    </section>
  )
}

/** Una propiedad: icono y nombre en gris a la izquierda, el valor a la derecha. */
export function PropertyRow({
  icon: Icon,
  label,
  children,
  action
}: {
  icon?: LucideIcon
  label: string
  children: ReactNode
  /** Botón al final de la fila (Cambiar, Abrir). */
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="group/prop grid min-h-[30px] grid-cols-[minmax(110px,160px)_minmax(0,1fr)] items-center gap-2">
      <span className="flex min-w-0 items-center gap-2 px-1.5 text-[13px] text-ob-muted">
        {Icon && <Icon size={14} className="shrink-0 text-ob-faint" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        {action}
      </div>
    </div>
  )
}
