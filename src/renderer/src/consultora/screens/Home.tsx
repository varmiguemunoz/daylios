import { useCallback, useMemo, useState } from 'react'
import { LayoutDashboard, Plus, RotateCcw } from 'lucide-react'
import {
  METRIC_PERIODS,
  WIDGET_METRIC,
  periodRange,
  type DashboardLayout,
  type MetricPeriod,
  type WidgetKind,
  type WidgetPlacement
} from '@shared/metrics'
import { todayKey } from '@shared/tasks'
import { errorMessage } from '../../lib/api'
import { useUiState } from '../../lib/ui-state'
import { api, useLoad, type Go } from '../lib'
import { Button, ErrorNote, Page, Select } from '../ui'
import { DashboardGrid } from '../organisms/dashboard/DashboardGrid'
import { WidgetCatalog } from '../organisms/dashboard/WidgetCatalog'
import { WidgetSettingsModal } from '../organisms/dashboard/WidgetSettingsModal'
import { WIDGETS } from '../organisms/dashboard/registry'
import { useAccount } from '../organisms/account/useAccount'
import { useOrgs } from '../organisms/orgs/useOrgs'
import {
  dashboardApi,
  ownsScope,
  rangeLabel,
  scopeQuery,
  useMetrics,
  type HomeScope
} from '../organisms/dashboard/lib'

const ALL = ''
const DATE =
  'h-[30px] rounded-[4px] border border-ob-border bg-ob-bg px-1.5 text-[13px] text-ob-text [color-scheme:dark]'

export function Home({ go }: { go: Go }): React.JSX.Element {
  const today = todayKey()
  const [period, setPeriod] = useUiState<MetricPeriod>('home.period', 'week', (v) =>
    METRIC_PERIODS.some((p) => p.id === v)
  )
  const [range, setRange] = useUiState(
    'home.range',
    { from: today, to: today },
    (v) => !!v && typeof (v as { from?: unknown }).from === 'string'
  )
  const [pipeline, setPipeline] = useUiState('home.pipeline', ALL, (v) => typeof v === 'string')
  const [mine, setMine] = useUiState('home.mine', false, (v) => typeof v === 'boolean')
  const account = useAccount()
  const { active } = useOrgs()
  const me = active.orgId ? (account.user?.id ?? null) : null
  const [editing, setEditing] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const [configuring, setConfiguring] = useState<WidgetPlacement | null>(null)
  const [pending, setPending] = useState<DashboardLayout | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(() => dashboardApi.dashboard(), [])
  const { data: dashboard, error: dashboardError, reload } = useLoad(loadDashboard)
  const loadPipelines = useCallback(() => api.listPipelines(), [])
  const { data: pipelines } = useLoad(loadPipelines)

  const layout = pending ?? dashboard?.layout ?? null
  // Un pipeline recordado que ya no existe cuenta como «Todos».
  const known = !pipeline || !!pipelines?.some((p) => p.id === pipeline)
  const scope: HomeScope = {
    period,
    range,
    pipeline: known ? pipeline : ALL,
    assignee: mine && me ? me : null
  }

  // Una sola consulta para todos los componentes que usan el periodo y el pipeline de Inicio.
  const sharedKinds = useMemo(
    () => [
      ...new Set(
        (layout?.widgets ?? []).filter((w) => !ownsScope(w)).map((w) => WIDGET_METRIC[w.kind])
      )
    ],
    [layout]
  )
  const shared = useMetrics(
    sharedKinds.length ? { ...scopeQuery(scope), kinds: sharedKinds } : null
  )

  const save = async (next: DashboardLayout | null): Promise<void> => {
    setPending(next)
    try {
      if (next) await dashboardApi.saveDashboard(next)
      else await dashboardApi.resetDashboard()
      setError(null)
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(null)
    }
  }

  const add = (kind: WidgetKind): void => {
    if (!layout) return
    const def = WIDGETS[kind]
    const widget: WidgetPlacement = {
      id: `w-${Date.now().toString(36)}`,
      kind,
      size: def.size,
      rows: def.rows,
      settings: {}
    }
    setCatalog(false)
    void save({ ...layout, widgets: [...layout.widgets, widget] })
  }

  const current = periodRange(period, today, range)

  return (
    <Page
      title="Inicio"
      meta={<span>{rangeLabel(current)} · comparado con el periodo anterior</span>}
      actions={
        <>
          <Select
            label="Periodo"
            value={period}
            onChange={(v) => setPeriod(v as MetricPeriod)}
            options={METRIC_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          />
          {period === 'range' && (
            <span className="flex items-center gap-1.5 text-[13px] text-ob-muted">
              <input
                type="date"
                aria-label="Desde"
                value={range.from}
                onChange={(e) =>
                  e.target.value && setRange((r) => ({ ...r, from: e.target.value }))
                }
                className={DATE}
              />
              a
              <input
                type="date"
                aria-label="Hasta"
                value={range.to}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
                className={DATE}
              />
            </span>
          )}
          <Select
            label="Pipeline"
            value={scope.pipeline}
            onChange={setPipeline}
            options={[
              { value: ALL, label: 'Todos los pipelines' },
              ...(pipelines ?? []).map((p) => ({ value: p.id, label: p.name }))
            ]}
          />
          {me && (
            <Button kind={mine ? 'primary' : 'quiet'} onClick={() => setMine(!mine)}>
              Mis tareas
            </Button>
          )}
          {editing ? (
            <>
              <Button onClick={() => setCatalog(true)}>
                <Plus size={15} />
                Añadir
              </Button>
              <Button
                onClick={() => void save(null)}
                title="Vuelve a los seis componentes iniciales"
              >
                <RotateCcw size={14} />
                Restablecer
              </Button>
              <Button kind="primary" onClick={() => setEditing(false)}>
                Listo
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <LayoutDashboard size={14} />
              Editar dashboard
            </Button>
          )}
        </>
      }
    >
      <ErrorNote message={error ?? dashboardError} />
      {editing && (
        <p className="mt-3 text-[13px] text-ob-muted">
          Arrastra para mover. Ajustes cambia el tamaño, el periodo o el pipeline de cada
          componente.
        </p>
      )}
      {layout && layout.widgets.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[14px] text-ob-muted">El dashboard está vacío.</p>
          <Button kind="primary" onClick={() => setCatalog(true)}>
            <Plus size={15} />
            Añadir componente
          </Button>
        </div>
      )}
      {layout && (
        <DashboardGrid
          layout={layout}
          shared={shared}
          scope={scope}
          editing={editing}
          go={go}
          onChange={(next) => void save(next)}
          onSettings={setConfiguring}
        />
      )}
      <WidgetCatalog
        open={catalog}
        present={new Set(layout?.widgets.map((w) => w.kind))}
        onAdd={add}
        onClose={() => setCatalog(false)}
      />
      {configuring && layout && (
        <WidgetSettingsModal
          widget={configuring}
          pipelines={pipelines ?? []}
          onClose={() => setConfiguring(null)}
          onSave={(w) => {
            setConfiguring(null)
            void save({ ...layout, widgets: layout.widgets.map((x) => (x.id === w.id ? w : x)) })
          }}
        />
      )}
    </Page>
  )
}
