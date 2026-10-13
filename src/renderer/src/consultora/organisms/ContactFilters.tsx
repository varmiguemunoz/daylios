import { Check } from 'lucide-react'
import type { ContactStatus, LeadSource, TagSummary } from '@shared/marketing'
import { Chips } from '../marketing-ui'
import { SearchField, SegmentedToggle, Select } from '../ui'
import { useState } from 'react'
import { normalizeName } from '@shared/consultora'

export type StatusFilter = ContactStatus | 'all'
export type PipelineFilter = 'any' | 'yes' | 'no'

export interface ContactFilterState {
  status: StatusFilter
  tags: string[]
  source: string
  client: string
  pipeline: PipelineFilter
}

export const EMPTY_CONTACT_FILTERS: ContactFilterState = {
  status: 'all',
  tags: [],
  source: '',
  client: '',
  pipeline: 'any'
}

/** Filtros activos (el número del botón). */
export const activeContactFilters = (f: ContactFilterState): number =>
  (f.status !== 'all' ? 1 : 0) + f.tags.length + (f.source ? 1 : 0) + (f.client ? 1 : 0) + (f.pipeline !== 'any' ? 1 : 0)

const STATUS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'subscribed', label: 'Suscritos' },
  { id: 'none', label: 'Sin marketing' },
  { id: 'unsubscribed', label: 'Bajas' },
  { id: 'bounced', label: 'Rebotes' },
  { id: 'complained', label: 'Spam' }
]

interface ContactFiltersProps {
  value: ContactFilterState
  onChange: (next: ContactFilterState) => void
  tags: TagSummary[]
  sources: LeadSource[]
  clients: { id: string; name: string }[]
}

/** Contenido del panel «Filtros» de Contactos. Aplica al instante. */
export function ContactFilters({ value, onChange, tags, sources, clients }: ContactFiltersProps): React.JSX.Element {
  const [tagQuery, setTagQuery] = useState('')
  const set = (patch: Partial<ContactFilterState>): void => onChange({ ...value, ...patch })
  const toggleTag = (slug: string): void =>
    set({ tags: value.tags.includes(slug) ? value.tags.filter((t) => t !== slug) : [...value.tags, slug] })
  const q = normalizeName(tagQuery)
  const shownTags = tags.filter((t) => !q || normalizeName(t.name).includes(q))

  return (
    <div className="flex flex-col gap-6 pt-1">
      <Group label="Suscripción">
        <div className="flex flex-wrap gap-1 [&>div]:flex-wrap">
          <Chips label="Suscripción" value={value.status} options={STATUS} onChange={(status) => set({ status })} />
        </div>
      </Group>

      <Group label="En pipeline">
        <SegmentedToggle
          label="En pipeline"
          value={value.pipeline}
          onChange={(pipeline) => set({ pipeline })}
          options={[
            { id: 'any', label: 'Todos' },
            { id: 'yes', label: 'Sí' },
            { id: 'no', label: 'No' }
          ]}
        />
      </Group>

      {clients.length > 0 && (
        <Group label="Empresa">
          <Select
            label="Empresa"
            value={value.client}
            options={[{ value: '', label: 'Todas las empresas' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(client) => set({ client })}
          />
        </Group>
      )}

      {sources.length > 0 && (
        <Group label="Fuente">
          <Select
            label="Fuente"
            value={value.source}
            options={[
              { value: '', label: 'Todas las fuentes' },
              { value: 'manual', label: 'A mano' },
              ...sources.map((s) => ({ value: s.slug, label: s.name }))
            ]}
            onChange={(source) => set({ source })}
          />
        </Group>
      )}

      <Group label={value.tags.length ? `Tags · deben tener los ${value.tags.length}` : 'Tags'}>
        {tags.length > 10 && (
          <div className="mb-2 flex">
            <SearchField value={tagQuery} onChange={setTagQuery} placeholder="Buscar tag" label="Buscar tag" />
          </div>
        )}
        {tags.length === 0 ? (
          <p className="text-caption text-milk-soft">Aún no hay tags.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shownTags.map((t) => {
              const on = value.tags.includes(t.slug)
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
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="shrink-0 text-micro font-bold text-milk-soft tabular-nums">{t.contacts}</span>
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
