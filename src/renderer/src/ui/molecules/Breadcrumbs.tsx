import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  id: string | null
  name: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  onSelect: (id: string | null) => void
  /** Soltar algo sobre un tramo (mover a esa carpeta). */
  onDropOn?: (id: string | null, e: React.DragEvent) => void
}

/** Ruta de navegación: cada tramo lleva a su carpeta; el último es donde estás. */
export function Breadcrumbs({ items, onSelect, onDropOn }: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav aria-label="Ruta" className="flex min-w-0 items-center gap-0.5 overflow-hidden">
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span
            key={c.id ?? 'root'}
            className={`flex items-center gap-0.5 ${last ? 'min-w-0' : 'shrink-0'}`}
          >
            {i > 0 && (
              <ChevronRight
                size={14}
                strokeWidth={2.5}
                className="shrink-0 text-milk-faint"
                aria-hidden
              />
            )}
            {last ? (
              <span
                aria-current="page"
                className="ui-crumb-current truncate px-1.5 text-caption font-extrabold text-milk"
              >
                {c.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                onDragOver={onDropOn ? (e) => e.preventDefault() : undefined}
                onDrop={onDropOn ? (e) => onDropOn(c.id, e) : undefined}
                className="ui-crumb max-w-40 truncate rounded-full px-1.5 py-0.5 text-caption font-bold text-milk-soft transition-colors hover:bg-surface hover:text-milk"
              >
                {c.name}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
