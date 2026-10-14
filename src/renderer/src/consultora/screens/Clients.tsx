import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Client, ClientStatus } from '@shared/consultora'
import { api, attempt, shortDate, useLoad, type Go } from '../lib'
import { Button, Empty, ErrorNote, INPUT, Page, Pill } from '../ui'
import { Chips } from '../marketing-ui'
import { Table, type Column } from '../molecules/Table'

const FILTERS: { id: ClientStatus | 'all'; label: string }[] = [
  { id: 'activo', label: 'Activos' },
  { id: 'historico', label: 'Históricos' },
  { id: 'all', label: 'Todos' }
]

type ClientRow = Client & { activeProjects: number; lastMeetingDate: string | null }

const COLUMNS: Column<ClientRow>[] = [
  {
    key: 'name',
    label: 'Nombre',
    width: '38%',
    render: (c) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{c.name}</span>
        {c.status === 'historico' && <Pill>Histórico</Pill>}
      </span>
    )
  },
  { key: 'sector', label: 'Sector', hideBelow: 'md', render: (c) => c.sector || '' },
  {
    key: 'projects',
    label: 'Proyectos activos',
    width: '150px',
    render: (c) =>
      c.activeProjects > 0 ? (
        <Pill tone="apricot">{c.activeProjects}</Pill>
      ) : (
        <span className="text-ob-faint">0</span>
      )
  },
  {
    key: 'meeting',
    label: 'Última reunión',
    width: '140px',
    align: 'right',
    render: (c) =>
      c.lastMeetingDate ? (
        shortDate(c.lastMeetingDate)
      ) : (
        <span className="text-ob-faint">sin reuniones</span>
      )
  }
]

/** Clientes como una tabla de Obsidian, con alta rápida (nombre y Enter). */
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
      meta={
        data && (
          <span>
            {data.length} {data.length === 1 ? 'cliente' : 'clientes'}
          </span>
        )
      }
      actions={
        <Button kind="primary" onClick={() => setName('')}>
          <Plus size={15} />
          Nuevo cliente
        </Button>
      }
    >
      <div className="mt-4">
        <Chips label="Estado" value={filter} options={FILTERS} onChange={setFilter} />
      </div>

      {name !== null && (
        <form
          className="mt-3"
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
            className={INPUT}
          />
        </form>
      )}

      <ErrorNote message={error ?? loadError} />

      <div className="mt-4">
        {data && data.length === 0 && (
          <Empty
            title={filter === 'historico' ? 'Sin clientes históricos.' : 'Aún no hay clientes.'}
            hint="Crea uno con «Nuevo cliente» o gana un prospecto en el pipeline."
          />
        )}
        {data && data.length > 0 && (
          <Table
            label="Clientes"
            columns={COLUMNS}
            rows={data}
            rowKey={(c) => c.id}
            onOpen={(c) => go({ name: 'client', id: c.id })}
          />
        )}
      </div>
    </Page>
  )
}
