import { useState } from 'react'

interface InlineFieldProps {
  label: string
  value: string | null
  placeholder: string
  onSave: (value: string) => void
  /** Tipo del campo al editar (teclado y validación nativa). */
  type?: 'text' | 'email' | 'tel' | 'url'
}

/** Dato de referencia: etiqueta micro + valor; clic edita en el sitio. Enter o salir guarda; Esc cancela. */
export function InlineField({ label, value, placeholder, onSave, type = 'text' }: InlineFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    if (draft !== null && draft.trim() !== (value ?? '')) onSave(draft.trim())
    setDraft(null)
  }

  return (
    <div className="flex min-h-11 flex-col justify-center rounded-sm px-3 py-1.5 transition-colors hover:bg-surface">
      <span className="text-micro font-bold text-milk-soft">{label}</span>
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
          className="-mx-1 rounded-[8px] bg-night/60 px-1 text-list outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setDraft(value ?? '')}
          className={`truncate text-left text-list ${value ? 'text-milk' : 'text-milk-soft'}`}
          title={value ? `${value} · clic para editar` : `Añadir ${label.toLowerCase()}`}
        >
          {value || placeholder}
        </button>
      )}
    </div>
  )
}
