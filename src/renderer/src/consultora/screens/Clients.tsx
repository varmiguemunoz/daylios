import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ClientStatus } from '@shared/consultora'
import { api, attempt, shortDate, useLoad, type Go } from '../lib'
import { Empty, ErrorNote, List, Page, Pill, Row } from '../ui'

const FILTERS: { id: ClientStatus | 'all'; label: string }[] = [
  { id: 'activo', label: 'Activos' },
  { id: 'historico', label: 'Históricos' },
  { id: 'all', label: 'Todos' }
]

/** Lista de clientes + alta rápida (nombre + Enter). */
export function Clients({ go }: { go: Go }): React.JSX.Element {
  const [filter, setFilter] = useState<ClientStatus | 'all'>('activo')
  const [name, setName] = useState<string | null>(null) // null = formulario cerrado
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => api.listClients(filter === 'all' ? undefined : filter), [filter])
  const { data, error: loadError } = useLoad(load)

  const create = async (): Promise<void> => {
    if (!name?.trim()) return setName(null)
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createClient({ name })).id
    })
    setError(failed)
    if (!failed) {
      setName(null)
      go({ name: 'client', id })
    }
  }

  return (
    <Page
      title="Clientes"
      actions={
        <button
          type="button"
          onClick={() => setName('')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo cliente
        </button>
      }
    >
      <div role="radiogroup" aria-label="Estado" className="mt-5 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-9 rounded-full px-3.5 text-caption font-bold transition-colors ${
              filter === f.id
                ? 'bg-apricot text-ink'
                : 'bg-surface text-milk-soft hover:bg-surface-raised hover:text-milk'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {name !== null && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setName(null)}
            placeholder="Nombre del cliente y Enter · se crea su carpeta de documentos"
            aria-label="Nombre del cliente"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}

      <ErrorNote message={error ?? loadError} />

      <div className="mt-6">
        {data && data.length === 0 && (
          <Empty
            title={filter === 'historico' ? 'Sin clientes históricos.' : 'Aún no hay clientes.'}
            hint="Crea uno con «Nuevo cliente» o gana un prospecto en el pipeline."
          />
        )}
        {data && data.length > 0 && (
          <List>
            {data.map((c) => (
              <Row key={c.id} onClick={() => go({ name: 'client', id: c.id })}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-list font-bold">{c.name}</span>
                  {c.sector && (
                    <span className="block truncate text-caption text-milk-soft">{c.sector}</span>
                  )}
                </span>
                {c.activeProjects > 0 && (
                  <Pill tone="apricot">
                    {c.activeProjects}{' '}
                    {c.activeProjects === 1 ? 'proyecto activo' : 'proyectos activos'}
                  </Pill>
                )}
                {c.status === 'historico' && <Pill>Histórico</Pill>}
                <span className="w-28 shrink-0 text-right text-caption text-milk-soft">
                  {c.lastMeetingDate ? shortDate(c.lastMeetingDate) : 'sin reuniones'}
                </span>
              </Row>
            ))}
          </List>
        )}
      </div>
    </Page>
  )
}
