import { useMemo, useState } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import { Modal, SearchField } from '../ui'
import { PropertyRow } from './Properties'

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
  icon?: LucideIcon
}

/**
 * Propiedad que enlaza a otra ficha, con buscador en lugar de un desplegable largo: el valor es un
 * enlace violeta como en Obsidian (clic lo abre) y «Cambiar» abre el buscador con «Quitar».
 */
export function RefPicker({
  label,
  value,
  options,
  onChange,
  onOpen,
  disabled,
  disabledHint,
  icon
}: RefPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = normalizeName(query)
  const shown = useMemo(
    () =>
      options
        .filter((o) => !q || normalizeName(`${o.label} ${o.hint ?? ''}`).includes(q))
        .slice(0, 40),
    [options, q]
  )

  const pick = (id: string): void => {
    setOpen(false)
    setQuery('')
    if (id !== (value?.id ?? '')) onChange(id)
  }

  return (
    <PropertyRow
      icon={icon}
      label={label}
      action={
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="flex h-[26px] shrink-0 items-center gap-0.5 rounded-[4px] px-2 text-[12px] text-ob-muted opacity-0 transition-[opacity,background-color,color] group-hover/prop:opacity-100 focus-visible:opacity-100 hover:bg-ob-hover hover:text-ob-text disabled:hidden"
        >
          {value ? 'Cambiar' : 'Asignar'}
          <ChevronRight size={13} />
        </button>
      }
    >
      {value ? (
        <button
          type="button"
          onClick={() => onOpen?.(value.id)}
          disabled={!onOpen}
          className="block h-[26px] max-w-full truncate rounded-[4px] px-1.5 text-left text-[14px] text-ob-link transition-colors hover:bg-ob-hover disabled:text-ob-text disabled:hover:bg-transparent"
        >
          {value.label}
          {value.hint && <span className="ml-1.5 text-ob-muted">{value.hint}</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="block h-[26px] max-w-full truncate rounded-[4px] px-1.5 text-left text-[14px] text-ob-faint transition-colors hover:bg-ob-hover disabled:hover:bg-transparent"
        >
          {disabled ? disabledHint : 'Sin asignar'}
        </button>
      )}

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
          <ul className="overflow-hidden rounded-[6px] border border-ob-border">
            {value && (
              <li>
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="w-full px-3 py-2 text-left text-[14px] text-ob-red transition-colors hover:bg-ob-red/10"
                >
                  Quitar {label.toLowerCase()}
                </button>
              </li>
            )}
            {shown.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-ob-faint">Nada coincide.</li>
            )}
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  aria-current={o.id === value?.id ? 'true' : undefined}
                  className={`w-full border-t border-ob-border px-3 py-1.5 text-left transition-colors first:border-t-0 hover:bg-ob-hover ${
                    o.id === value?.id ? 'bg-ob-active' : ''
                  }`}
                >
                  <span className="block truncate text-[14px] text-ob-text">{o.label}</span>
                  {o.hint && (
                    <span className="block truncate text-[12px] text-ob-faint">{o.hint}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </PropertyRow>
  )
}
