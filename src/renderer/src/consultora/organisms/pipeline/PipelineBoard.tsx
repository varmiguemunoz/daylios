import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Pipeline, ProspectCard, StageKind } from '@shared/consultora'
import { money } from '../../lib'
import { CountBadge } from '../../ui'
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
  /** `index` = posición final en la columna completa (sin filtros). */
  onMove: (id: string, stageId: string, index: number) => void
  onCreate: (stageId: string, company: string) => Promise<boolean>
}

/**
 * Tablero de columnas como el plugin Kanban de Obsidian: columnas grises con nombre, conteo y valor;
 * «+» para crear ahí;
 * arrastrar tarjetas entre columnas; ←/→ o mantener pulsado el fondo para moverse en horizontal.
 */
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
        <section
          key={stage.id}
          className={`flex shrink-0 flex-col rounded-[8px] border bg-ob-alt transition-colors ${
            drag.dragging && drag.target?.group === stage.id
              ? 'border-ob-accent/60'
              : 'border-ob-border'
          }`}
          style={{ width: COLUMN }}
          aria-label={stage.name}
        >
          <div className="flex h-10 shrink-0 items-center justify-between gap-2 pr-1.5 pl-3">
            <span className="flex min-w-0 items-center gap-1.5">
              {stage.kind !== 'open' && (
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${stage.kind === 'won' ? 'bg-ob-green' : 'bg-ob-faint'}`}
                />
              )}
              <span
                className={`min-w-0 truncate text-[13px] font-semibold ${
                  stage.kind === 'lost' ? 'text-ob-muted' : 'text-ob-text'
                }`}
              >
                {stage.name}
              </span>
              <CountBadge count={shown.length} />
            </span>
            <span className="flex items-center gap-1">
              {stage.valueUsd > 0 && (
                <span className="text-[12px] text-ob-muted tabular-nums">
                  {money(stage.valueUsd)}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setAdding(stage.id)
                  setDraft('')
                }}
                aria-label={`Nuevo prospecto en ${stage.name}`}
                title="Nuevo prospecto aquí"
                className="grid size-7 place-items-center rounded-[4px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text"
              >
                <Plus size={15} />
              </button>
            </span>
          </div>
          <div
            className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5"
            {...drag.zone(stage.id, shown.length)}
          >
            {adding === stage.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit(stage.id)
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => !draft.trim() && setAdding(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setAdding(null)
                    }
                  }}
                  placeholder="Empresa o persona y Enter"
                  aria-label={`Nuevo prospecto en ${stage.name}`}
                  className="h-8 w-full rounded-[4px] border border-ob-accent bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none placeholder:text-ob-faint"
                />
              </form>
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
          </div>
        </section>
      ))}
    </div>
  )
}
