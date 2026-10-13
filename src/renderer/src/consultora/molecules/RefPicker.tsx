import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import { Modal, SearchField } from '../ui'

export interface RefOption {
  id: string
  label: string
  hint?: string
}

interface RefPickerProps {
  /** Qué es («Cliente», «Proyecto», «Prospecto»). */
  label: string
  value: { id: string; label: string; hint?: string } | null
  options: RefOption[]
  onChange: (id: string) => void
  /** Abrir lo seleccionado (p. ej. ir a la ficha del cliente). */
  onOpen?: (id: string) => void
  disabled?: boolean
  disabledHint?: string
}

/**
 * Relación con búsqueda, en lugar de un desplegable largo: la fila muestra el vínculo (clic lo abre)
 * y «Cambiar» abre un buscador con «Quitar».
 */
export function RefPicker({ label, value, options, onChange, onOpen, disabled, disabledHint }: RefPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = normalizeName(query)
  const shown = useMemo(
    () => options.filter((o) => !q || normalizeName(`${o.label} ${o.hint ?? ''}`).includes(q)).slice(0, 40),
    [options, q]
  )

  const pick = (id: string): void => {
    setOpen(false)
    setQuery('')
    if (id !== (value?.id ?? '')) onChange(id)
  }

  return (
    <div className="flex min-h-11 items-center gap-2 rounded-sm px-3 py-1.5 transition-colors hover:bg-surface">
      <span className="min-w-0 flex-1">
        <span className="block text-micro font-bold text-milk-soft">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onOpen?.(value.id)}
            disabled={!onOpen}
            className="block max-w-full truncate text-left text-list font-bold text-milk hover:text-apricot disabled:hover:text-milk"
          >
            {value.label}
            {value.hint && <span className="ml-1.5 font-normal text-milk-soft">{value.hint}</span>}
          </button>
        ) : (
          <span className="block truncate text-list text-milk-soft">{disabled ? disabledHint : 'Sin asignar'}</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex h-8 shrink-0 items-center gap-0.5 rounded-full px-2.5 text-micro font-bold text-milk-soft transition-colors hover:bg-surface-raised hover:text-milk disabled:text-milk-faint disabled:hover:bg-transparent"
      >
        {value ? 'Cambiar' : 'Asignar'}
        <ChevronRight size={13} strokeWidth={2.5} />
      </button>

      <Modal open={open} title={`${label}`} onClose={() => setOpen(false)} size="sm">
        <div className="flex flex-col gap-3">
          <div className="flex">
            <SearchField
              value={query}
              onChange={setQuery}
              autoFocus
              placeholder={`Buscar ${label.toLowerCase()}`}
              onEnter={() => shown[0] && pick(shown[0].id)}
            />
          </div>
          <ul className="overflow-hidden rounded-md bg-night/40 [&>li+li]:shadow-[inset_0_1px_0_var(--color-hairline)]">
            {value && (
              <li>
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="w-full px-4 py-2.5 text-left text-list text-rose transition-colors hover:bg-rose/10"
                >
                  Quitar {label.toLowerCase()}
                </button>
              </li>
            )}
            {shown.length === 0 && <li className="px-4 py-3 text-caption text-milk-soft">Nada coincide.</li>}
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  aria-current={o.id === value?.id ? 'true' : undefined}
                  className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-raised ${
                    o.id === value?.id ? 'bg-surface-raised' : ''
                  }`}
                >
                  <span className="block truncate text-list font-bold">{o.label}</span>
                  {o.hint && <span className="block truncate text-caption text-milk-soft">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  )
}
