import { Search, X } from 'lucide-react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  autoFocus?: boolean
  onEnter?: () => void
}

/** Pill de búsqueda. La X vacía el campo. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label = 'Buscar',
  autoFocus,
  onEnter
}: SearchFieldProps): React.JSX.Element {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]">
      <Search size={15} strokeWidth={2.5} className="shrink-0 text-milk-soft" aria-hidden />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-list outline-none placeholder:text-milk-soft"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Vaciar búsqueda"
          className="grid size-6 shrink-0 place-items-center rounded-full text-milk-soft hover:bg-surface-raised hover:text-milk"
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}
    </label>
  )
}
