import { useState } from 'react'
import type { PipelineSummary } from '@shared/consultora'
import {
  METRIC_PERIODS,
  WIDGET_SIZES,
  type MetricPeriod,
  type WidgetPlacement,
  type WidgetSize
} from '@shared/metrics'
import { todayKey } from '@shared/tasks'
import { Button, Modal, Select, SegmentedToggle } from '../../ui'
import { WIDGETS } from './registry'

const SIZE_LABEL: Record<WidgetSize, string> = { quarter: 'Un cuarto', half: 'Medio', full: 'Todo' }
const INHERIT = ''
const DATE =
  'h-[30px] rounded-[4px] border border-ob-border bg-ob-bg px-1.5 text-[13px] text-ob-text [color-scheme:dark]'

export function WidgetSettingsModal({
  widget,
  pipelines,
  onSave,
  onClose
}: {
  widget: WidgetPlacement
  pipelines: PipelineSummary[]
  onSave: (widget: WidgetPlacement) => void
  onClose: () => void
}): React.JSX.Element | null {
  const def = WIDGETS[widget.kind]
  const [draft, setDraft] = useState(widget)
  const today = todayKey()
  const set = (patch: Partial<WidgetPlacement['settings']>): void =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const choosePeriod = (value: string): void => {
    const period = (value || undefined) as MetricPeriod | undefined
    set({
      period,
      from: period === 'range' ? (draft.settings.from ?? today) : undefined,
      to: period === 'range' ? (draft.settings.to ?? today) : undefined
    })
  }

  return (
    <Modal
      open
      size="sm"
      title={`Ajustes · ${def.title}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button kind="primary" onClick={() => onSave(draft)}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-[13px] text-ob-muted">
        <div className="flex items-center justify-between gap-3">
          Ancho
          <SegmentedToggle
            label="Ancho"
            value={draft.size}
            onChange={(size) => setDraft((d) => ({ ...d, size }))}
            options={WIDGET_SIZES.map((s) => ({ id: s, label: SIZE_LABEL[s] }))}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          Alto
          <SegmentedToggle
            label="Alto"
            value={String(draft.rows) as '1' | '2'}
            onChange={(rows) => setDraft((d) => ({ ...d, rows: rows === '2' ? 2 : 1 }))}
            options={[
              { id: '1', label: 'Una fila' },
              { id: '2', label: 'Dos filas' }
            ]}
          />
        </div>
        {def.settings.includes('period') && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-3">
              Periodo
              <Select
                label="Periodo del componente"
                value={draft.settings.period ?? INHERIT}
                onChange={choosePeriod}
                options={[
                  { value: INHERIT, label: 'El de Inicio' },
                  ...METRIC_PERIODS.map((p) => ({ value: p.id, label: p.label }))
                ]}
              />
            </label>
            {draft.settings.period === 'range' && (
              <span className="flex items-center justify-end gap-1.5">
                <input
                  type="date"
                  aria-label="Desde"
                  value={draft.settings.from ?? today}
                  onChange={(e) => e.target.value && set({ from: e.target.value })}
                  className={DATE}
                />
                a
                <input
                  type="date"
                  aria-label="Hasta"
                  value={draft.settings.to ?? today}
                  onChange={(e) => e.target.value && set({ to: e.target.value })}
                  className={DATE}
                />
              </span>
            )}
          </div>
        )}
        {def.settings.includes('pipeline') && (
          <label className="flex items-center justify-between gap-3">
            Pipeline
            <Select
              label="Pipeline del componente"
              value={draft.settings.pipeline ?? INHERIT}
              onChange={(v) => set({ pipeline: v || undefined })}
              options={[
                { value: INHERIT, label: 'El de Inicio' },
                ...pipelines.map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
          </label>
        )}
      </div>
    </Modal>
  )
}
