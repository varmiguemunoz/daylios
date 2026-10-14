import { addDays, fromDayKey, toDayKey, type DayKey, type TaskStatus } from './tasks'

// ---- Periodos ----

export type MetricPeriod = 'week' | 'month' | 'quarter' | 'year' | 'range'

export const METRIC_PERIODS: { id: MetricPeriod; label: string }[] = [
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'quarter', label: 'Este trimestre' },
  { id: 'year', label: 'Este año' },
  { id: 'range', label: 'Rango' }
]

export interface DayRange {
  from: DayKey
  to: DayKey
}

const pad = (n: number): string => String(n).padStart(2, '0')
const key = (y: number, m: number, d: number): DayKey => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number): number => new Date(y, m, 0).getDate()

export function periodRange(period: MetricPeriod, today: DayKey, range?: DayRange): DayRange {
  const [y, m] = today.split('-').map(Number)
  switch (period) {
    case 'week': {
      const weekday = (fromDayKey(today).getDay() + 6) % 7
      const from = addDays(today, -weekday)
      return { from, to: addDays(from, 6) }
    }
    case 'month':
      return { from: key(y, m, 1), to: key(y, m, lastDay(y, m)) }
    case 'quarter': {
      const first = Math.floor((m - 1) / 3) * 3 + 1
      return { from: key(y, first, 1), to: key(y, first + 2, lastDay(y, first + 2)) }
    }
    case 'year':
      return { from: key(y, 1, 1), to: key(y, 12, 31) }
    case 'range':
      return range && range.from <= range.to ? range : { from: today, to: today }
  }
}

export function rangeDays(r: DayRange): number {
  const ms = fromDayKey(r.to).getTime() - fromDayKey(r.from).getTime()
  return Math.round(ms / 86_400_000) + 1
}

export function previousRange(r: DayRange): DayRange {
  const to = addDays(r.from, -1)
  return { from: addDays(to, -(rangeDays(r) - 1)), to }
}

export const dayOf = (iso: string): DayKey => toDayKey(new Date(iso))

export const inRange = (day: DayKey, r: DayRange): boolean => day >= r.from && day <= r.to

// ---- Indicadores ----

export type MetricKind =
  | 'tasks'
  | 'tasksByStatus'
  | 'openPipeline'
  | 'won'
  | 'lost'
  | 'valueByStage'
  | 'winRate'
  | 'overdue'
  | 'meetings'
  | 'actionItems'
  | 'contacts'

export const METRIC_KINDS: MetricKind[] = [
  'tasks',
  'tasksByStatus',
  'openPipeline',
  'won',
  'lost',
  'valueByStage',
  'winRate',
  'overdue',
  'meetings',
  'actionItems',
  'contacts'
]

export interface MetricsQuery {
  period: MetricPeriod

  from?: DayKey
  to?: DayKey

  pipeline?: string | null
  assignee?: string | null

  kinds?: MetricKind[]
}

export interface TrendPoint {
  from: DayKey
  value: number
}

export interface TaskCountsMetric {
  open: number

  closed: number
  closedPrevious: number
  trend: TrendPoint[]
}

export type TasksByStatusMetric = Record<TaskStatus, number>

export interface DealRow {
  prospectId: string
  company: string
  valueUsd: number
  at: string
  pipelineId: string | null
}

export interface DealsMetric {
  count: number
  valueUsd: number
  countPrevious: number
  valueUsdPrevious: number
  rows: DealRow[]

  estimated: boolean
}

export interface OpenPipelineMetric {
  count: number
  valueUsd: number
}

export interface StageValue {
  id: string
  name: string
  count: number
  valueUsd: number
}

export interface ValueByStageMetric {
  pipeline: { id: string; name: string } | null
  stages: StageValue[]
}

export interface WinRateMetric {
  rate: number | null
  ratePrevious: number | null
  won: number
  lost: number
}

export interface OverdueTaskRow {
  id: string
  title: string
  date: DayKey
}

export interface OverdueStepRow {
  prospectId: string
  company: string
  nextStep: string | null
  date: DayKey
}

export interface OverdueMetric {
  tasks: OverdueTaskRow[]
  steps: OverdueStepRow[]
}

export interface MeetingsMetric {
  count: number
  rows: { id: string; title: string; date: DayKey }[]
}

export interface ActionItemsMetric {
  count: number
  rows: {
    meetingId: string
    meetingTitle: string
    index: number
    text: string
    due: string | null
  }[]
}

export interface ContactsMetric {
  created: number
  createdPrevious: number

  subscribed: number
  trend: TrendPoint[]
}

export interface MetricValues {
  tasks: TaskCountsMetric
  tasksByStatus: TasksByStatusMetric
  openPipeline: OpenPipelineMetric
  won: DealsMetric
  lost: DealsMetric
  valueByStage: ValueByStageMetric
  winRate: WinRateMetric
  overdue: OverdueMetric
  meetings: MeetingsMetric
  actionItems: ActionItemsMetric
  contacts: ContactsMetric
}

export interface MetricsResult extends Partial<MetricValues> {
  today: DayKey
  range: DayRange
  previous: DayRange
  pipeline: { id: string; name: string } | null
}

// ---- Dashboard ----

export type WidgetKind =
  | 'tasks-open-closed'
  | 'tasks-by-status'
  | 'pipeline-open'
  | 'deals-won'
  | 'deals-lost'
  | 'value-by-stage'
  | 'win-rate'
  | 'overdue'
  | 'meetings'
  | 'action-items'
  | 'contacts'

export const WIDGET_KINDS: WidgetKind[] = [
  'tasks-open-closed',
  'tasks-by-status',
  'pipeline-open',
  'deals-won',
  'deals-lost',
  'value-by-stage',
  'win-rate',
  'overdue',
  'meetings',
  'action-items',
  'contacts'
]

export type WidgetSize = 'quarter' | 'half' | 'full'
export const WIDGET_SIZES: WidgetSize[] = ['quarter', 'half', 'full']

export interface WidgetSettings {
  period?: MetricPeriod
  from?: DayKey
  to?: DayKey
  pipeline?: string
}

export interface WidgetPlacement {
  id: string
  kind: WidgetKind
  size: WidgetSize
  rows: 1 | 2
  settings: WidgetSettings
}

export interface DashboardLayout {
  version: 1
  widgets: WidgetPlacement[]
}

export interface Dashboard {
  id: string
  name: string
  layout: DashboardLayout
  updatedAt: string
}

export const MAX_WIDGETS = 24

export const DEFAULT_LAYOUT: DashboardLayout = {
  version: 1,
  widgets: [
    { id: 'w-tasks', kind: 'tasks-open-closed', size: 'quarter', rows: 1, settings: {} },
    { id: 'w-open', kind: 'pipeline-open', size: 'quarter', rows: 1, settings: {} },
    { id: 'w-won', kind: 'deals-won', size: 'quarter', rows: 1, settings: {} },
    { id: 'w-lost', kind: 'deals-lost', size: 'quarter', rows: 1, settings: {} },
    { id: 'w-stages', kind: 'value-by-stage', size: 'half', rows: 2, settings: {} },
    { id: 'w-status', kind: 'tasks-by-status', size: 'half', rows: 2, settings: {} }
  ]
}

export const WIDGET_METRIC: Record<WidgetKind, MetricKind> = {
  'tasks-open-closed': 'tasks',
  'tasks-by-status': 'tasksByStatus',
  'pipeline-open': 'openPipeline',
  'deals-won': 'won',
  'deals-lost': 'lost',
  'value-by-stage': 'valueByStage',
  'win-rate': 'winRate',
  overdue: 'overdue',
  meetings: 'meetings',
  'action-items': 'actionItems',
  contacts: 'contacts'
}

export interface DashboardApi {
  metrics(query: MetricsQuery): Promise<MetricsResult>
  dashboard(): Promise<Dashboard>
  saveDashboard(layout: DashboardLayout): Promise<Dashboard>
  resetDashboard(): Promise<Dashboard>
}
