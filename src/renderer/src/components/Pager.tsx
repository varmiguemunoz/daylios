import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PagerProps {
  page: number
  totalPages: number
  onPage: (page: number) => void
}

/** Paginación «‹ Página n de m ›». No se muestra si hay una sola página. */
export function Pager({ page, totalPages, onPage }: PagerProps): React.JSX.Element | null {
  if (totalPages <= 1) return null

  const button =
    'grid size-9 place-items-center rounded-full bg-surface text-milk hover:bg-surface-raised disabled:text-milk-faint disabled:hover:bg-surface'

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between px-6 pt-2 pb-1 text-caption font-bold"
    >
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        className={button}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-milk-soft">
        Página <span className="text-milk">{page}</span> de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        aria-label="Página siguiente"
        className={button}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
