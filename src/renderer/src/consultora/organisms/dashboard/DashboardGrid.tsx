import { GripVertical, SlidersHorizontal, X } from 'lucide-react'
import type { DashboardLayout, MetricsResult, WidgetPlacement, WidgetSize } from '@shared/metrics'
import { finalIndex, useReorder } from '../../../lib/useReorder'
import type { Go } from '../../lib'
import { WIDGETS } from './registry'
import { ownsScope, scopeQuery, useMetrics, type HomeScope } from './lib'

const SPAN: Record<WidgetSize, string> = {
  quarter: 'col-span-1',
  half: 'col-span-2',
  full: 'col-span-2 @3xl:col-span-4'
}

const GROUP = 'dashboard'

export function DashboardGrid({
  layout,
  shared,
  scope,
  editing,
  go,
  onChange,
  onSettings
}: {
  layout: DashboardLayout
  shared: { data: MetricsResult | null; error: string | null }
  scope: HomeScope
  editing: boolean
  go: Go
  onChange: (layout: DashboardLayout) => void
  onSettings: (widget: WidgetPlacement) => void
}): React.JSX.Element {
  const widgets = layout.widgets
  const drag = useReorder((id, index) => {
    const from = widgets.findIndex((w) => w.id === id)
    if (from < 0) return
    const next = [...widgets]
    const [moved] = next.splice(from, 1)
    next.splice(finalIndex(index, from), 0, moved)
    onChange({ ...layout, widgets: next })
  })
  const remove = (id: string): void =>
    onChange({ ...layout, widgets: widgets.filter((w) => w.id !== id) })

  return (
    <div
      {...(editing ? drag.zone(GROUP, widgets.length) : {})}
      className="mt-5 grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-3 @3xl:grid-cols-4"
    >
      {widgets.map((w, index) => {
        const def = WIDGETS[w.kind]
        const toolbar = editing ? (
          <>
            <button
              type="button"
              aria-label={`Ajustes de ${def.title}`}
              title="Ajustes"
              onClick={() => onSettings(w)}
              className="grid size-6 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-hover hover:text-ob-text"
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              type="button"
              aria-label={`Quitar ${def.title}`}
              title="Quitar"
              onClick={() => remove(w.id)}
              className="grid size-6 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-red/15 hover:text-ob-red"
            >
              <X size={14} />
            </button>
            <span
              aria-hidden
              className="grid size-6 cursor-grab place-items-center text-ob-faint"
              title="Arrastra para mover"
            >
              <GripVertical size={14} />
            </span>
          </>
        ) : undefined
        const marker =
          editing && drag.target?.index === index && drag.dragging !== w.id
            ? 'ring-2 ring-ob-accent/60'
            : ''
        return (
          <div
            key={w.id}
            {...(editing ? drag.item(w.id, index, GROUP) : {})}
            className={`${SPAN[w.size]} ${w.rows === 2 ? 'row-span-2' : ''} min-w-0 rounded-[8px] ${marker} ${
              drag.dragging === w.id ? 'opacity-40' : ''
            }`}
          >
            {ownsScope(w) ? (
              <OwnWidget widget={w} scope={scope} go={go} toolbar={toolbar} />
            ) : (
              <def.View result={shared.data} error={shared.error} go={go} toolbar={toolbar} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function OwnWidget({
  widget,
  scope,
  go,
  toolbar
}: {
  widget: WidgetPlacement
  scope: HomeScope
  go: Go
  toolbar?: React.ReactNode
}): React.JSX.Element {
  const { data, error } = useMetrics(scopeQuery(scope, widget))
  const { View } = WIDGETS[widget.kind]
  return <View result={data} error={error} go={go} toolbar={toolbar} />
}
