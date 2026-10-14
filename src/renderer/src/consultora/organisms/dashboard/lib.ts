import { useCallback } from 'react'
import type { StageKind } from '@shared/consultora'
import { EMPTY_PIPELINE_FILTERS } from '@shared/pipeline-filters'
import {
  WIDGET_METRIC,
  type DayRange,
  type MetricPeriod,
  type MetricsQuery,
  type MetricsResult,
  type WidgetPlacement
} from '@shared/metrics'
import type { TaskPeriod } from '@shared/tasks'
import { uiState } from '../../../lib/ui-state'
import { shortDate, useLoad, type Go } from '../../lib'
import { EMPTY_TASK_FILTERS } from '../tasks/lib'

export const dashboardApi = window.api.dashboard

export interface HomeScope {
  period: MetricPeriod
  range: DayRange
  pipeline: string
  assignee: string | null
}

export const ownsScope = (w: WidgetPlacement): boolean =>
  !!w.settings.period || !!w.settings.pipeline

export function scopeQuery(scope: HomeScope, w?: WidgetPlacement): MetricsQuery {
  const period = w?.settings.period ?? scope.period
  const range = w?.settings.period === 'range' ? w.settings : scope.range
  return {
    period,
    from: period === 'range' ? range.from : undefined,
    to: period === 'range' ? range.to : undefined,
    pipeline: (w?.settings.pipeline ?? scope.pipeline) || null,
    assignee: scope.assignee ?? undefined,
    kinds: w ? [WIDGET_METRIC[w.kind]] : undefined
  }
}

export function useMetrics(query: MetricsQuery | null): {
  data: MetricsResult | null
  error: string | null
} {
  const key = JSON.stringify(query)
  const load = useCallback(() => {
    const q = JSON.parse(key) as MetricsQuery | null
    return q ? dashboardApi.metrics(q) : Promise.resolve(null)
  }, [key])
  const { data, error } = useLoad(load)
  return { data, error }
}

export const rangeLabel = (r: DayRange): string =>
  r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} a ${shortDate(r.to)}`

const usdShort = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
})
const usdFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})

export const usd = (n: number, compact = true): string =>
  compact && Math.abs(n) >= 10_000 ? usdShort.format(n) : usdFull.format(n)

export const percent = (n: number | null): string =>
  n === null ? 'Sin cierres' : `${Math.round(n * 100)}%`

// ---- Abrir el origen de un indicador ----

export function openTasks(go: Go, period: TaskPeriod): void {
  uiState.set('tasks.period', period)
  uiState.set('tasks.filters', EMPTY_TASK_FILTERS)
  go({ name: 'tasks' })
}

export function openPipeline(
  go: Go,
  pipeline: string | null,
  filter: { kinds?: StageKind[]; overdue?: boolean }
): void {
  const id = pipeline ?? uiState.get<string>('pipeline.last', '')
  if (pipeline) uiState.set('pipeline.last', pipeline)
  uiState.set(`pipeline.view.${id}`, 'list')
  uiState.set('pipeline.filters', {
    ...EMPTY_PIPELINE_FILTERS,
    kinds: filter.kinds ?? [],
    overdue: !!filter.overdue
  })
  go({ name: 'pipeline' })
}
