import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { PropertyRow } from './Properties'

interface InlineFieldProps {
  label: string
  value: string | null
  placeholder: string
  onSave: (value: string) => void
  /** Tipo del campo al editar (teclado y validación nativa). */
  type?: 'text' | 'email' | 'tel' | 'url'
  icon?: LucideIcon
}

/** Propiedad editable en el sitio: clic edita, Enter o salir guarda, Esc cancela. */
export function InlineField({
  label,
  value,
  placeholder,
  onSave,
  type = 'text',
  icon
}: InlineFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    if (draft !== null && draft.trim() !== (value ?? '')) onSave(draft.trim())
    setDraft(null)
  }

  return (
    <PropertyRow icon={icon} label={label}>
      {draft !== null ? (
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDraft(null)
            }
          }}
          spellCheck={false}
          aria-label={label}
          className="h-[26px] w-full rounded-[4px] border border-ob-accent bg-ob-bg px-1.5 text-[14px] text-ob-text outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setDraft(value ?? '')}
          className={`block h-[26px] w-full truncate rounded-[4px] px-1.5 text-left text-[14px] transition-colors hover:bg-ob-hover ${
            value ? 'text-ob-text' : 'text-ob-faint'
          }`}
          title={value ? `${value} · clic para editar` : `Añadir ${label.toLowerCase()}`}
        >
          {value || placeholder}
        </button>
      )}
    </PropertyRow>
  )
}
