import { useCallback } from 'react'
import { EFFORTS, type Effort } from '@shared/tasks'
import { tasksApi } from '../../../lib/api'
import { api, useLoad } from '../../lib'
import { SearchField, Select } from '../../ui'
import { Chips } from '../../marketing-ui'
import type { TaskFilters } from './lib'

const EFFORT_OPTIONS: { id: Effort | ''; label: string }[] = [
  { id: '', label: 'Cualquiera' },
  ...EFFORTS.map((e) => ({ id: e, label: e[0].toUpperCase() + e.slice(1) }))
]

export function TaskFiltersPanel({
  value,
  onChange
}: {
  value: TaskFilters
  onChange: (next: TaskFilters) => void
}): React.JSX.Element {
  const tagsLoad = useCallback(() => tasksApi.tags(), [])
  const { data: tags } = useLoad(tagsLoad)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const projects = (refs?.projects ?? []).filter(
    (p) => !value.client || p.clientId === value.client
  )
  const set = (patch: Partial<TaskFilters>): void => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-6 pt-1">
      <Group label="Texto">
        <div className="flex">
          <SearchField
            value={value.query}
            onChange={(query) => set({ query })}
            placeholder="Título o descripción"
            label="Buscar en tareas"
          />
        </div>
      </Group>
      <Group label="Esfuerzo">
        <Chips
          label="Esfuerzo"
          value={value.effort}
          options={EFFORT_OPTIONS}
          onChange={(effort) => set({ effort })}
        />
      </Group>
      <Group label="Tags">
        {(tags ?? []).length === 0 ? (
          <p className="text-[13px] text-ob-faint">Aún no hay tags.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(tags ?? []).map((tag) => {
              const on = value.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({ tags: on ? value.tags.filter((t) => t !== tag) : [...value.tags, tag] })
                  }
                  className={`h-6 rounded-full px-2 text-[12px] transition-colors ${
                    on
                      ? 'bg-ob-accent text-white'
                      : 'bg-ob-accent/15 text-ob-link hover:bg-ob-accent/25'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </Group>
      <Group label="Cliente">
        <Select
          label="Cliente"
          value={value.client}
          options={[
            { value: '', label: 'Todos' },
            ...(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
          ]}
          onChange={(client) => set({ client, project: '' })}
        />
      </Group>
      <Group label="Proyecto">
        <Select
          label="Proyecto"
          value={value.project}
          options={[
            { value: '', label: 'Todos' },
            ...projects.map((p) => ({ value: p.id, label: p.name }))
          ]}
          onChange={(project) => set({ project })}
        />
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
      <h3 className="mb-2 text-[12px] font-medium text-ob-muted">{label}</h3>
      {children}
    </section>
  )
}
