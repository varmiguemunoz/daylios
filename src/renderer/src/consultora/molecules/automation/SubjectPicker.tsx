import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { SUBJECT_LABELS, type SubjectOption, type SubjectType } from '@shared/automations'
import { SearchField } from '../../../ui'
import { errorMessage } from '../../../lib/api'

const automations = window.api.automations

export function SubjectPicker({
  subject,
  value,
  onChange
}: {
  subject: SubjectType
  value: SubjectOption | null
  onChange: (option: SubjectOption) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SubjectOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const timer = window.setTimeout(() => {
      automations
        .subjects(subject, query)
        .then((r) => {
          if (!live) return
          setRows(r)
          setError(null)
        })
        .catch((e) => {
          if (live) setError(errorMessage(e))
        })
    }, 150)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [subject, query])

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={`Buscar ${SUBJECT_LABELS[subject].toLowerCase()}`}
        autoFocus
      />
      {error && <p className="text-[12px] text-ob-red">{error}</p>}
      <ul className="flex max-h-64 flex-col overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onChange(r)}
              aria-pressed={value?.id === r.id}
              className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left hover:bg-ob-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ob-text">{r.label}</span>
                {r.hint && (
                  <span className="block truncate text-[12px] text-ob-muted">{r.hint}</span>
                )}
              </span>
              {value?.id === r.id && (
                <Check size={14} className="shrink-0 text-ob-link" aria-hidden />
              )}
            </button>
          </li>
        ))}
        {!rows.length && !error && (
          <li className="px-2 py-4 text-center text-[13px] text-ob-faint">Sin resultados.</li>
        )}
      </ul>
    </div>
  )
}
