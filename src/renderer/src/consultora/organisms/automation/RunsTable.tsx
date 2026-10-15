import { useCallback, useMemo, useState } from 'react'
import { Play, RotateCcw, Square } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { RunStatus, RunView } from '@shared/automations'
import { IconButton, SearchField } from '../../../ui'
import { attempt, dateTime } from '../../lib'
import { Empty, ErrorNote } from '../../ui'
import { Chips } from '../../marketing-ui'
import { Table, type Column } from '../../molecules/Table'
import { RunStatusPill } from '../../molecules/automation/StatusPills'
import { useLiveLoad } from '../../hooks/useLiveLoad'

const automations = window.api.automations
type Filter = 'all' | RunStatus

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'En curso' },
  { id: 'waiting', label: 'Esperando' },
  { id: 'finished', label: 'Terminadas' },
  { id: 'failed', label: 'Fallidas' },
  { id: 'cancelled', label: 'Canceladas' }
]

const REASON: Record<string, string> = { user: 'A mano', claude: 'Claude', system: 'Automática' }

export function RunActions({
  run,
  onDone
}: {
  run: RunView
  onDone: (error: string | null) => void
}): React.JSX.Element {
  const act = async (fn: () => Promise<unknown>): Promise<void> => onDone(await attempt(fn))
  return (
    <span className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {run.status === 'waiting' && (
        <IconButton
          label="Reanudar ya"
          size="sm"
          onClick={() => void act(() => automations.resume(run.id))}
        >
          <Play size={14} />
        </IconButton>
      )}
      {run.status === 'failed' && (
        <IconButton
          label="Reintentar"
          size="sm"
          onClick={() => void act(() => automations.retry(run.id))}
        >
          <RotateCcw size={14} />
        </IconButton>
      )}
      {(run.status === 'active' || run.status === 'waiting') && (
        <IconButton
          label="Cancelar"
          size="sm"
          tone="danger"
          onClick={() => void act(() => automations.cancel(run.id))}
        >
          <Square size={13} />
        </IconButton>
      )}
    </span>
  )
}

export function RunsTable({
  automationId,
  subjectId,
  showAutomation,
  onOpen
}: {
  automationId?: string
  subjectId?: string
  showAutomation?: boolean
  onOpen: (run: RunView) => void
}): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [since, setSince] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () =>
      automations.runs({
        automationId,
        subjectId,
        status: filter === 'all' ? undefined : filter,
        limit: 200
      }),
    [automationId, subjectId, filter]
  )
  const { data, error: loadError } = useLiveLoad(load)
  const q = normalizeName(query)
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (r) =>
          (!q || normalizeName(r.subjectLabel ?? '').includes(q)) &&
          (!since || r.createdAt.slice(0, 10) >= since)
      ),
    [data, q, since]
  )

  const columns: Column<RunView>[] = [
    {
      key: 'subject',
      label: showAutomation ? 'Automatización' : 'Sujeto',
      render: (r) =>
        showAutomation
          ? r.automationName
          : (r.subjectLabel ?? (r.subjectId ? 'Borrado' : 'Sin sujeto'))
    },
    {
      key: 'status',
      label: 'Estado',
      width: '170px',
      render: (r) => <RunStatusPill status={r.status} late={r.late} />
    },
    { key: 'node', label: 'Paso actual', render: (r) => r.nodeName ?? (r.reason || '—') },
    {
      key: 'origin',
      label: 'Motivo',
      width: '100px',
      hideBelow: 'lg',
      render: (r) => REASON[r.origin] ?? r.origin
    },
    {
      key: 'created',
      label: 'Entró',
      width: '150px',
      hideBelow: 'md',
      render: (r) => dateTime(r.createdAt),
      sortValue: (r) => r.createdAt
    },
    {
      key: 'next',
      label: 'Próxima',
      width: '150px',
      hideBelow: 'lg',
      render: (r) => (r.nextAt ? dateTime(r.nextAt) : '—')
    },
    {
      key: 'actions',
      label: '',
      width: '96px',
      align: 'right',
      render: (r) => <RunActions run={r} onDone={setError} />
    }
  ]

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chips label="Estado" value={filter} options={FILTERS} onChange={setFilter} />
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-[12px] text-ob-muted">
          Desde
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="h-[26px] rounded-[4px] border border-ob-border bg-ob-bg px-1.5 text-[12px] text-ob-text outline-none focus:border-ob-accent"
          />
        </label>
        {!showAutomation && (
          <div className="w-56">
            <SearchField value={query} onChange={setQuery} placeholder="Buscar sujeto" />
          </div>
        )}
      </div>
      <ErrorNote message={error ?? loadError} />
      {data && rows.length === 0 ? (
        <Empty title="No hay ejecuciones con estos filtros." />
      ) : (
        <Table
          label="Ejecuciones"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
