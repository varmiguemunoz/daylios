import { Check } from 'lucide-react'
import type { StageKind } from '@shared/consultora'
import type { TagRef } from '@shared/marketing'
import type { PipelineFilters } from '@shared/pipeline-filters'
import { SearchField } from '../../ui'

interface PipelineFiltersPanelProps {
  filters: PipelineFilters
  onChange: (next: PipelineFilters) => void
  /** Tags presentes en los contactos de los prospectos de este pipeline. */
  tags: TagRef[]
}

const KINDS: { id: StageKind; label: string }[] = [
  { id: 'open', label: 'Abiertas' },
  { id: 'won', label: 'Ganadas' },
  { id: 'lost', label: 'Perdidas' }
]

/** Contenido del panel «Filtros» del pipeline. Aplica al instante. */
export function PipelineFiltersPanel({ filters, onChange, tags }: PipelineFiltersPanelProps): React.JSX.Element {
  const set = (patch: Partial<PipelineFilters>): void => onChange({ ...filters, ...patch })
  const toggleKind = (k: StageKind): void =>
    set({ kinds: filters.kinds.includes(k) ? filters.kinds.filter((x) => x !== k) : [...filters.kinds, k] })
  const toggleTag = (slug: string): void =>
    set({ tags: filters.tags.includes(slug) ? filters.tags.filter((x) => x !== slug) : [...filters.tags, slug] })

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
                className={`h-9 rounded-full px-3.5 text-caption font-bold transition-colors ${
                  on ? 'bg-apricot text-ink' : 'bg-surface-raised text-milk-soft hover:text-milk'
                }`}
              >
                {k.label}
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Próximo paso">
        <Toggle on={filters.overdue} onChange={(overdue) => set({ overdue })} label="Solo vencidos" />
      </Group>

      <Group label="Valor mínimo (USD)">
        <input
          type="number"
          min={0}
          step={500}
          value={filters.minValue ?? ''}
          onChange={(e) => set({ minValue: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
          placeholder="Sin mínimo"
          aria-label="Valor mínimo en USD"
          className="h-11 w-full rounded-full bg-surface-raised px-4 text-list tabular-nums outline-none placeholder:text-milk-soft focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
        />
      </Group>

      <Group label="Tags de sus contactos">
        {tags.length === 0 ? (
          <p className="text-caption text-milk-soft">Ningún contacto de este pipeline tiene tags.</p>
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
                    className="flex h-10 w-full items-center gap-2.5 rounded-sm px-2 text-left text-list transition-colors hover:bg-surface-raised"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full ${
                        on ? 'bg-apricot text-ink' : 'shadow-[inset_0_0_0_1.5px_var(--color-milk-faint)]'
                      }`}
                    >
                      {on && <Check size={12} strokeWidth={3} />}
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

function Group({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-2 text-micro font-bold text-milk-soft">{label}</h3>
      {children}
    </section>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-10 items-center gap-3 rounded-full text-list"
    >
      <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? 'bg-apricot' : 'bg-surface-raised'}`}>
        <span
          className={`absolute top-1 size-4 rounded-full transition-[left,background-color] ${on ? 'left-5 bg-ink' : 'left-1 bg-milk-soft'}`}
        />
      </span>
      {label}
    </button>
  )
}
