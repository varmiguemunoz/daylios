import type { WidgetKind, WidgetSize } from '@shared/metrics'
import {
  ActionItems,
  Contacts,
  DealsLost,
  DealsWon,
  Meetings,
  Overdue,
  PipelineOpen,
  TasksByStatus,
  TasksOpenClosed,
  ValueByStage,
  WinRate,
  type WidgetViewProps
} from './widgets'

export type WidgetSettingKey = 'period' | 'pipeline'

export interface WidgetDef {
  kind: WidgetKind
  title: string
  description: string
  size: WidgetSize
  rows: 1 | 2

  settings: WidgetSettingKey[]
  View: (props: WidgetViewProps) => React.JSX.Element
}

export const WIDGETS: Record<WidgetKind, WidgetDef> = {
  'tasks-open-closed': {
    kind: 'tasks-open-closed',
    title: 'Tareas abiertas y cerradas',
    description: 'Abiertas ahora, cerradas en el periodo y su tendencia.',
    size: 'quarter',
    rows: 1,
    settings: ['period'],
    View: TasksOpenClosed
  },
  'tasks-by-status': {
    kind: 'tasks-by-status',
    title: 'Tareas por estado',
    description: 'Pendiente, En curso y Hecha de las tareas del periodo.',
    size: 'half',
    rows: 1,
    settings: ['period'],
    View: TasksByStatus
  },
  'pipeline-open': {
    kind: 'pipeline-open',
    title: 'Pipeline abierto',
    description: 'Valor de los prospectos en etapas abiertas.',
    size: 'quarter',
    rows: 1,
    settings: ['pipeline'],
    View: PipelineOpen
  },
  'deals-won': {
    kind: 'deals-won',
    title: 'Negocios ganados',
    description: 'Cantidad y valor ganados en el periodo.',
    size: 'quarter',
    rows: 1,
    settings: ['period', 'pipeline'],
    View: DealsWon
  },
  'deals-lost': {
    kind: 'deals-lost',
    title: 'Negocios perdidos',
    description: 'Cantidad y valor perdidos en el periodo.',
    size: 'quarter',
    rows: 1,
    settings: ['period', 'pipeline'],
    View: DealsLost
  },
  'value-by-stage': {
    kind: 'value-by-stage',
    title: 'Valor por etapa',
    description: 'Barras por etapa abierta del pipeline.',
    size: 'half',
    rows: 2,
    settings: ['pipeline'],
    View: ValueByStage
  },
  'win-rate': {
    kind: 'win-rate',
    title: 'Tasa de cierre',
    description: 'Ganados sobre ganados más perdidos.',
    size: 'quarter',
    rows: 1,
    settings: ['period', 'pipeline'],
    View: WinRate
  },
  overdue: {
    kind: 'overdue',
    title: 'Atrasadas',
    description: 'Tareas de días pasados y próximos pasos vencidos.',
    size: 'half',
    rows: 2,
    settings: ['pipeline'],
    View: Overdue
  },
  meetings: {
    kind: 'meetings',
    title: 'Reuniones',
    description: 'Reuniones del periodo.',
    size: 'quarter',
    rows: 2,
    settings: ['period'],
    View: Meetings
  },
  'action-items': {
    kind: 'action-items',
    title: 'Action items abiertos',
    description: 'Lo pendiente de todas las reuniones.',
    size: 'quarter',
    rows: 2,
    settings: [],
    View: ActionItems
  },
  contacts: {
    kind: 'contacts',
    title: 'Contactos nuevos',
    description: 'Contactos nuevos y suscritos del email marketing.',
    size: 'quarter',
    rows: 1,
    settings: ['period'],
    View: Contacts
  }
}
