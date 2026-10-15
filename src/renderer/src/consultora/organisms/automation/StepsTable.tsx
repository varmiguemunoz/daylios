import { useCallback, useState } from 'react'
import { nodeSpec, type Definition, type RunStep, type StepStatus } from '@shared/automations'
import { dateTime, humanize } from '../../lib'
import { Empty, ErrorNote, Select } from '../../ui'
import { Chips } from '../../marketing-ui'
import { Table, type Column } from '../../molecules/Table'
import { StepStatusPill } from '../../molecules/automation/StatusPills'
import { useLiveLoad } from '../../hooks/useLiveLoad'

const automations = window.api.automations
type Filter = 'all' | StepStatus

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'ok', label: 'Hechos' },
  { id: 'skipped', label: 'Omitidos' },
  { id: 'waiting', label: 'Esperando' },
  { id: 'failed', label: 'Fallidos' },
  { id: 'retrying', label: 'Reintentando' }
]

export function StepsTable({
  automationId,
  def
}: {
  automationId: string
  def: Definition
}): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [nodeId, setNodeId] = useState('')
  const load = useCallback(
    () =>
      automations.steps({
        automationId,
        nodeId: nodeId || undefined,
        status: filter === 'all' ? undefined : filter,
        limit: 300
      }),
    [automationId, nodeId, filter]
  )
  const { data, error } = useLiveLoad(load)
  const name = (s: RunStep): string =>
    def.nodes[s.nodeId]?.name ?? nodeSpec(s.nodeType)?.label ?? s.nodeType

  const columns: Column<RunStep>[] = [
    { key: 'node', label: 'Paso', render: name },
    {
      key: 'status',
      label: 'Estado',
      width: '120px',
      render: (s) => <StepStatusPill status={s.status} />
    },
    {
      key: 'message',
      label: 'Mensaje',
      render: (s) => <span title={s.message ?? ''}>{s.message ? humanize(s.message) : '—'}</span>
    },
    {
      key: 'attempt',
      label: 'Intento',
      width: '70px',
      align: 'right',
      hideBelow: 'lg',
      render: (s) => s.attempt
    },
    {
      key: 'start',
      label: 'Inicio',
      width: '150px',
      hideBelow: 'md',
      render: (s) => dateTime(s.startedAt)
    },
    {
      key: 'end',
      label: 'Fin',
      width: '150px',
      hideBelow: 'lg',
      render: (s) => (s.endedAt ? dateTime(s.endedAt) : '—')
    }
  ]

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chips label="Estado" value={filter} options={FILTERS} onChange={setFilter} />
        <span className="flex-1" />
        <Select
          label="Paso"
          value={nodeId}
          onChange={setNodeId}
          options={[
            { value: '', label: 'Todos los pasos' },
            ...Object.values(def.nodes).map((n) => ({ value: n.id, label: n.name || n.type }))
          ]}
        />
      </div>
      <ErrorNote message={error} />
      {data && data.length === 0 ? (
        <Empty
          title="Aún no hay pasos registrados."
          hint="Aparecen en cuanto alguien entra en la automatización."
        />
      ) : (
        <Table label="Registro de pasos" columns={columns} rows={data ?? []} rowKey={(s) => s.id} />
      )}
    </div>
  )
}
