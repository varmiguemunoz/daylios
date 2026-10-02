import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ContactStatus, TagRef } from '@shared/marketing'
import { Pill } from './ui'

/**
 * Piezas del email marketing. Mismo mundo (DESIGN.md), One Meaning Rule:
 * mint = suscrito (recibe emails), coral = rebote o queja (error), neutro = baja o sin marketing.
 * Los tags son neutros: un tag es una etiqueta, no un estado.
 */

const STATUS: Record<ContactStatus, { tone: 'mint' | 'coral' | 'neutral'; label: string } | null> =
  {
    none: null,
    subscribed: { tone: 'mint', label: 'Suscrito' },
    unsubscribed: { tone: 'neutral', label: 'Baja' },
    bounced: { tone: 'coral', label: 'Rebotó' },
    complained: { tone: 'coral', label: 'Spam' }
  }

/** Estado de suscripción. `none` no muestra nada (contacto de trabajo: calma por defecto). */
export function ContactStatusPill({ status }: { status: ContactStatus }): React.JSX.Element | null {
  const entry = STATUS[status]
  return entry ? <Pill tone={entry.tone}>{entry.label}</Pill> : null
}

/** Grupo de chips de una sola elección (patrón Periodo de Historial). */
export function Chips<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: { id: T; label: ReactNode }[]
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-9 shrink-0 rounded-full px-3.5 text-caption font-bold transition-colors ${
            value === o.id
              ? 'bg-apricot text-ink'
              : 'bg-surface text-milk-soft hover:bg-surface-raised hover:text-milk'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tag en una lista (solo lectura). */
export function TagPill({ tag }: { tag: TagRef }): React.JSX.Element {
  return (
    <span
      title={tag.slug}
      className="inline-flex h-6 max-w-40 shrink-0 items-center truncate rounded-full bg-surface-raised px-2.5 text-micro font-bold text-milk-soft"
    >
      {tag.name}
    </span>
  )
}

/** Hasta `max` tags y «+n» con el resto. */
export function TagList({
  tags,
  max = 2
}: {
  tags: TagRef[]
  max?: number
}): React.JSX.Element | null {
  if (!tags.length) return null
  const rest = tags.length - max
  return (
    <span className="flex shrink-0 items-center gap-1">
      {tags.slice(0, max).map((t) => (
        <TagPill key={t.slug} tag={t} />
      ))}
      {rest > 0 && (
        <span
          className="text-micro font-bold text-milk-soft"
          title={tags
            .slice(max)
            .map((t) => t.name)
            .join(', ')}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

/**
 * Editor de tags: pills con «quitar» y un campo para añadir (Enter o coma).
 * `suggestions` = tags existentes (autocompletado nativo).
 */
export function TagEditor({
  tags,
  suggestions,
  onAdd,
  onRemove
}: {
  tags: TagRef[]
  suggestions: TagRef[]
  onAdd: (tag: string) => void
  onRemove: (slug: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const commit = (): void => {
    const value = draft.trim()
    if (value) onAdd(value)
    setDraft('')
  }
  const free = suggestions.filter((s) => !tags.some((t) => t.slug === s.slug))

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface px-3 py-2.5">
      {tags.map((t) => (
        <span
          key={t.slug}
          title={t.slug}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-raised pr-1 pl-3 text-caption font-bold"
        >
          {t.name}
          <button
            type="button"
            onClick={() => onRemove(t.slug)}
            aria-label={`Quitar tag ${t.name}`}
            className="grid size-6 place-items-center rounded-full text-milk-soft transition-colors hover:bg-rose/15 hover:text-rose"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onRemove(tags[tags.length - 1].slug)
          }
        }}
        onBlur={commit}
        list="contact-tag-suggestions"
        placeholder={tags.length ? 'Añadir…' : 'Añadir tag y Enter'}
        aria-label="Añadir tag"
        className="h-8 min-w-32 flex-1 bg-transparent px-1 text-caption outline-none placeholder:text-milk-soft"
      />
      <datalist id="contact-tag-suggestions">
        {free.map((s) => (
          <option key={s.slug} value={s.name} />
        ))}
      </datalist>
    </div>
  )
}
