import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ContactStatus, TagRef } from '@shared/marketing'
import { Pill } from './ui'

const STATUS: Record<ContactStatus, { tone: 'mint' | 'coral' | 'neutral'; label: string } | null> =
  {
    none: null,
    subscribed: { tone: 'mint', label: 'Suscrito' },
    unsubscribed: { tone: 'neutral', label: 'Baja' },
    bounced: { tone: 'coral', label: 'Rebotó' },
    complained: { tone: 'coral', label: 'Spam' }
  }

export function ContactStatusPill({ status }: { status: ContactStatus }): React.JSX.Element | null {
  const entry = STATUS[status]
  return entry ? <Pill tone={entry.tone}>{entry.label}</Pill> : null
}

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
          className={`h-[26px] shrink-0 rounded-[4px] px-2.5 text-[12px] font-medium transition-colors ${
            value === o.id
              ? 'bg-ob-active text-ob-text'
              : 'text-ob-muted hover:bg-ob-hover hover:text-ob-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TagPill({ tag }: { tag: TagRef }): React.JSX.Element {
  return (
    <span
      title={tag.slug}
      className="inline-flex h-5 max-w-40 shrink-0 items-center truncate rounded-full bg-ob-accent/15 px-2 text-[12px] text-ob-link"
    >
      {tag.name}
    </span>
  )
}

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
          className="text-[12px] text-ob-faint"
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
    <div className="flex min-h-[30px] flex-wrap items-center gap-1 rounded-[4px] border border-ob-border bg-ob-bg px-1.5 py-1 transition-colors focus-within:border-ob-accent">
      {tags.map((t) => (
        <span
          key={t.slug}
          title={t.slug}
          className="inline-flex h-5 items-center gap-0.5 rounded-full bg-ob-accent/15 pr-0.5 pl-2 text-[12px] text-ob-link"
        >
          {t.name}
          <button
            type="button"
            onClick={() => onRemove(t.slug)}
            aria-label={`Quitar tag ${t.name}`}
            className="grid size-4 place-items-center rounded-full text-ob-link transition-colors hover:bg-ob-red/20 hover:text-ob-red"
          >
            <X size={11} strokeWidth={2.5} />
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
        className="h-6 min-w-32 flex-1 bg-transparent px-1 text-[13px] text-ob-text outline-none placeholder:text-ob-faint"
      />
      <datalist id="contact-tag-suggestions">
        {free.map((s) => (
          <option key={s.slug} value={s.name} />
        ))}
      </datalist>
    </div>
  )
}
