import { SlidersHorizontal } from 'lucide-react'
import { CountBadge } from '../atoms/CountBadge'

/** Pill «Filtros» con el número de filtros activos. */
export function FilterButton({
  count,
  onClick
}: {
  count: number
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count ? `Filtros, ${count} activos` : 'Filtros'}
      className="ui-btn flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-caption font-bold text-milk transition-colors hover:bg-surface-raised"
    >
      <SlidersHorizontal
        size={15}
        strokeWidth={2.5}
        className={count ? 'text-apricot' : 'text-milk-soft'}
      />
      Filtros
      {count > 0 && <CountBadge count={count} tone="apricot" />}
    </button>
  )
}
