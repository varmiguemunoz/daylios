import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { MAX_TAGS, cleanTag } from '@shared/tasks'
import { tasksApi } from '../lib/api'

export function TaskTagEditor({
  tags,
  onChange
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [known, setKnown] = useState<string[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    void tasksApi
      .tags()
      .then(setKnown)
      .catch(() => undefined)
  }, [])

  const add = (raw: string): void => {
    const tag = cleanTag(raw)
    setDraft('')
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) onChange([...tags, tag])
  }

  const typed = cleanTag(draft)
  const suggestions = known
    .filter((t) => !tags.includes(t) && (!typed || t.startsWith(typed)))
    .slice(0, 6)
  const room = tags.length < MAX_TAGS

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md bg-surface px-2 py-1.5 focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-raised pr-1 pl-3 text-caption font-bold text-milk-soft"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Quitar ${tag}`}
              className="grid size-5 place-items-center rounded-full hover:bg-hairline hover:text-milk"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </span>
        ))}
        {room && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                e.preventDefault()
                add(draft)
              } else if (e.key === 'Backspace' && !draft && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              if (draft) add(draft)
            }}
            placeholder={tags.length ? 'otro tag' : 'añadir tag'}
            aria-label="Nuevo tag"
            className="h-7 min-w-20 flex-1 bg-transparent px-1.5 text-caption outline-none placeholder:text-milk-soft"
          />
        )}
      </div>
      {focused && room && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag)}
              className="h-6 rounded-full px-2.5 text-micro font-bold text-milk-soft shadow-[inset_0_0_0_1.5px_var(--color-hairline)] hover:text-milk"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
