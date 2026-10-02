import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { EFFORTS, MAX_TAGS, cleanTag, type Effort } from '@shared/tasks'
import { tasksApi } from '../lib/api'

const EFFORT_LABEL: Record<Effort, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

/**
 * Tags y esfuerzo en el detalle de una tarea.
 * Tags: escribe y Enter (o elige una sugerencia); × quita. Esfuerzo: clic elige, clic otra vez quita.
 */
export function TaskTagsEffort({
  tags,
  effort,
  onTags,
  onEffort
}: {
  tags: string[]
  effort: Effort | null
  onTags: (tags: string[]) => void
  onEffort: (effort: Effort | null) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [known, setKnown] = useState<string[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    void tasksApi.tags().then(setKnown).catch(() => undefined)
  }, [])

  const add = (raw: string): void => {
    const tag = cleanTag(raw)
    setDraft('')
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) onTags([...tags, tag])
  }

  const typed = cleanTag(draft)
  const suggestions = known.filter((t) => !tags.includes(t) && (!typed || t.startsWith(typed))).slice(0, 5)

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Esfuerzo" className="flex items-center gap-2">
        <span className="w-16 text-caption font-bold text-milk-soft">Esfuerzo</span>
        <div className="flex rounded-full bg-surface p-1">
          {EFFORTS.map((level) => {
            const active = effort === level
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onEffort(active ? null : level)}
                className={`h-7 rounded-full px-3 text-caption font-bold transition-colors ${
                  active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
                }`}
              >
                {EFFORT_LABEL[level]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className="w-16 pt-1 text-caption font-bold text-milk-soft">Tags</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-raised pr-1 pl-3 text-caption font-bold text-milk-soft">
              #{tag}
              <button
                type="button"
                onClick={() => onTags(tags.filter((t) => t !== tag))}
                aria-label={`Quitar ${tag}`}
                className="grid size-5 place-items-center rounded-full hover:bg-hairline hover:text-milk"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </span>
          ))}
          {tags.length < MAX_TAGS && (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                  e.preventDefault()
                  add(draft)
                } else if (e.key === 'Backspace' && !draft && tags.length) {
                  onTags(tags.slice(0, -1))
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  setDraft('')
                  e.currentTarget.blur()
                }
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false)
                if (draft) add(draft)
              }}
              placeholder={tags.length ? '' : 'añadir tag'}
              aria-label="Nuevo tag"
              className="h-7 w-24 min-w-0 bg-transparent text-caption outline-none"
            />
          )}
        </div>
      </div>
      {focused && suggestions.length > 0 && tags.length < MAX_TAGS && (
        <div className="flex flex-wrap gap-1.5 pl-[72px]">
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
