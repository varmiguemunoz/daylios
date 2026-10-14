import { Check } from 'lucide-react'
import type { StageKind } from '@shared/consultora'
import type { TagRef } from '@shared/marketing'
import type { PipelineFilters } from '@shared/pipeline-filters'
import { SearchField } from '../../ui'

interface PipelineFiltersPanelProps {
  filters: PipelineFilters
  onChange: (next: PipelineFilters) => void

  tags: TagRef[]
}

const KINDS: { id: StageKind; label: string }[] = [
  { id: 'open', label: 'Abiertas' },
  { id: 'won', label: 'Ganadas' },
  { id: 'lost', label: 'Perdidas' }
]

export function PipelineFiltersPanel({
  filters,
  onChange,
  tags
}: PipelineFiltersPanelProps): React.JSX.Element {
  const set = (patch: Partial<PipelineFilters>): void => onChange({ ...filters, ...patch })
  const toggleKind = (k: StageKind): void =>
    set({
      kinds: filters.kinds.includes(k)
        ? filters.kinds.filter((x) => x !== k)
        : [...filters.kinds, k]
    })
  const toggleTag = (slug: string): void =>
    set({
      tags: filters.tags.includes(slug)
        ? filters.tags.filter((x) => x !== slug)
        : [...filters.tags, slug]
    })

  return (
    <div className="flex flex-col gap-6 pt-1">
      <Group label="Buscar">
        <div className="flex">
          <SearchField
            value={filters.query}
            onChange={(query) => set({ query })}
            placeholder="Empresa, contacto, notas…"
            label="Buscar en el pipeline"
          />
        </div>
      </Group>

      <Group label="Etapas">
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => {
            const on = filters.kinds.includes(k.id)
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k.id)}
                className={`h-[30px] rounded-[4px] px-3.5 text-caption font-medium transition-colors ${
                  on ? 'bg-ob-accent text-white' : 'bg-ob-hover text-ob-muted hover:text-ob-text'
                }`}
              >
                {k.label}
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Próximo paso">
        <Toggle
          on={filters.overdue}
          onChange={(overdue) => set({ overdue })}
          label="Solo vencidos"
        />
      </Group>

      <Group label="Valor mínimo (USD)">
        <input
          type="number"
          min={0}
          step={500}
          value={filters.minValue ?? ''}
          onChange={(e) =>
            set({ minValue: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
          }
          placeholder="Sin mínimo"
          aria-label="Valor mínimo en USD"
          className="h-8 w-full px-2.5 text-[14px] tabular-nums rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
        />
      </Group>

      <Group label="Tags de sus contactos">
        {tags.length === 0 ? (
          <p className="text-caption text-ob-muted">Ningún contacto de este pipeline tiene tags.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {tags.map((t) => {
              const on = filters.tags.includes(t.slug)
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleTag(t.slug)}
                    className="flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-list transition-colors hover:bg-ob-hover"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-[4px] ${
                        on
                          ? 'bg-ob-accent text-white'
                          : 'shadow-[inset_0_0_0_1.5px_var(--color-ob-faint)]'
                      }`}
                    >
                      {on && <Check size={12} />}
                    </span>
                    <span className="min-w-0 truncate">{t.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Group>
    </div>
  )
}

function Group({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-2 text-micro font-medium text-ob-muted">{label}</h3>
      {children}
    </section>
  )
}

function Toggle({
  on,
  onChange,
  label
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-8 items-center gap-3 rounded-[4px] text-list"
    >
      <span
        className={`relative h-6 w-10 rounded-full transition-colors ${on ? 'bg-ob-accent' : 'bg-ob-hover'}`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full transition-[left,background-color] ${on ? 'left-5 bg-white' : 'left-1 bg-ob-muted'}`}
        />
      </span>
      {label}
    </button>
  )
}
