import { useRef, useState } from 'react'
import type { Pipeline, ProspectCard, StageKind } from '@shared/consultora'
import { money } from '../../lib'
import { KanbanAddField, KanbanColumn } from '../kanban/KanbanColumn'
import { finalIndex, useReorder } from '../../../lib/useReorder'
import { useBoardNav } from '../../../lib/useBoardNav'
import { ProspectCardView } from './ProspectCardView'

const COLUMN = 280
const GAP = 10

interface PipelineBoardProps {
  data: Pipeline
  visible: (card: ProspectCard, kind: StageKind) => boolean
  today: string
  onOpen: (id: string) => void

  onMove: (id: string, stageId: string, index: number) => void
  onCreate: (stageId: string, company: string) => Promise<boolean>
}

export function PipelineBoard({
  data,
  visible,
  today,
  onOpen,
  onMove,
  onCreate
}: PipelineBoardProps): React.JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const { panning } = useBoardNav(scroller, COLUMN + GAP)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const columns = data.stages.map((stage) => ({
    stage,
    shown: stage.prospects.filter((p) => visible(p, stage.kind))
  }))

  const drag = useReorder((id, index, stageId) => {
    const column = columns.find((c) => c.stage.id === stageId)
    if (!column) return
    const full = column.stage.prospects
    // Índice en la lista visible → índice en la columna completa
    const anchor = column.shown[index]
    let at = anchor ? full.findIndex((p) => p.id === anchor.id) : full.length
    const from = full.findIndex((p) => p.id === id)
    if (from >= 0) at = finalIndex(at, from)
    onMove(id, stageId, at)
  })

  const dropLine = (stageId: string, i: number, count: number): string => {
    const t = drag.target
    if (!drag.dragging || !t || t.group !== stageId) return ''
    if (t.index === i) return 'shadow-[0_-3px_0_0_var(--color-ob-accent)]'
    if (i === count - 1 && t.index === count) return 'shadow-[0_3px_0_0_var(--color-ob-accent)]'
    return ''
  }

  const submit = async (stageId: string): Promise<void> => {
    if (!draft.trim()) return setAdding(null)
    if (await onCreate(stageId, draft.trim())) {
      setDraft('')
      setAdding(null)
    }
  }

  return (
    <div
      ref={scroller}
      className={`no-scrollbar flex min-h-0 flex-1 gap-2.5 overflow-x-auto pr-6 pb-4 ${
        panning
          ? 'cursor-grabbing rounded-md shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-ob-accent)_40%,transparent)] select-none'
          : ''
      }`}
      aria-label={`Pipeline ${data.pipeline.name}. Flechas para moverte entre columnas.`}
    >
      {columns.map(({ stage, shown }) => (
        <KanbanColumn
          key={stage.id}
          title={stage.name}
          count={shown.length}
          dot={stage.kind === 'won' ? 'green' : stage.kind === 'lost' ? 'faint' : undefined}
          muted={stage.kind === 'lost'}
          width={COLUMN}
          highlight={Boolean(drag.dragging && drag.target?.group === stage.id)}
          aside={
            stage.valueUsd > 0 && (
              <span className="text-[12px] text-ob-muted tabular-nums">
                {money(stage.valueUsd)}
              </span>
            )
          }
          onAdd={() => {
            setAdding(stage.id)
            setDraft('')
          }}
          addLabel={`Nuevo prospecto en ${stage.name}`}
          bodyProps={drag.zone(stage.id, shown.length)}
        >
          {adding === stage.id && (
            <KanbanAddField
              value={draft}
              onChange={setDraft}
              onSubmit={() => void submit(stage.id)}
              onCancel={() => setAdding(null)}
              placeholder="Empresa o persona y Enter"
              label={`Nuevo prospecto en ${stage.name}`}
            />
          )}
          {shown.map((p, i) => (
            <ProspectCardView
              key={p.id}
              card={p}
              late={p.nextStepDate !== null && p.nextStepDate < today && stage.kind === 'open'}
              dragging={drag.dragging === p.id}
              dropClass={dropLine(stage.id, i, shown.length)}
              onOpen={() => onOpen(p.id)}
              drag={drag.item(p.id, i, stage.id)}
            />
          ))}
          {shown.length === 0 && adding !== stage.id && (
            <p className="px-2 py-3 text-[12px] text-ob-faint">Suelta aquí</p>
          )}
        </KanbanColumn>
      ))}
    </div>
  )
}
