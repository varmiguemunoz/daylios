import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Pipeline, ProspectCard, Stage, StageKind } from '@shared/consultora'
import { money, shortDate } from '../../lib'

type SortKey = 'company' | 'stage' | 'value' | 'contact' | 'next' | 'date' | 'updated'

interface Row {
  card: ProspectCard
  stage: Stage
}

interface PipelineTableProps {
  data: Pipeline
  visible: (card: ProspectCard, kind: StageKind) => boolean
  today: string
  onOpen: (id: string) => void
  onStage: (id: string, stageId: string) => void
}

/** `wide` = solo con espacio (contenedor ≥ 768px). */
const COLUMNS: { key: SortKey; label: string; className: string; wide?: boolean }[] = [
  { key: 'company', label: 'Prospecto', className: 'min-w-0 flex-[2]' },
  { key: 'stage', label: 'Etapa', className: 'w-32 shrink-0 @3xl:w-40' },
  { key: 'value', label: 'Valor', className: 'w-24 shrink-0 text-right' },
  { key: 'contact', label: 'Contacto', className: 'min-w-0 flex-1', wide: true },
  { key: 'next', label: 'Próximo paso', className: 'min-w-0 flex-[1.5]' },
  { key: 'date', label: 'Fecha', className: 'w-24 shrink-0' },
  { key: 'updated', label: 'Actualizado', className: 'w-24 shrink-0', wide: true }
]

/** Vista de lista: las mismas tarjetas en columnas fijas, ordenables; la etapa se cambia en la fila. */
export function PipelineTable({
  data,
  visible,
  today,
  onOpen,
  onStage
}: PipelineTableProps): React.JSX.Element {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'stage', dir: 1 })

  const rows = useMemo(() => {
    const list: Row[] = data.stages.flatMap((stage) =>
      stage.prospects.filter((p) => visible(p, stage.kind)).map((card) => ({ card, stage }))
    )
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case 'company':
          return r.card.company.toLowerCase()
        case 'stage':
          return r.stage.position * 100000 + r.card.position
        case 'value':
          return r.card.valueUsd ?? -1
        case 'contact':
          return (r.card.contact?.name ?? '').toLowerCase()
        case 'next':
          return (r.card.nextStep ?? '').toLowerCase()
        case 'date':
          return r.card.nextStepDate ?? '9999'
        case 'updated':
          return r.card.updatedAt
      }
    }
    return list.sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [data, visible, sort])

  const toggle = (key: SortKey): void =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))

  return (
    <div className="@container mt-1">
      <div className="flex h-7 items-center gap-3 border-b border-ob-border px-2 text-[12px] font-medium text-ob-muted">
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
            className={`items-center gap-1 truncate hover:text-ob-text ${c.wide ? 'hidden @3xl:flex' : 'flex'} ${c.className} ${c.key === 'value' ? 'justify-end' : ''}`}
          >
            {c.label}
            {sort.key === c.key &&
              (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="px-2 py-6 text-center text-[14px] text-ob-muted">
          Ningún prospecto coincide.
        </p>
      )}
      <ul className="[&>li]:border-b [&>li]:border-ob-border">
        {rows.map(({ card, stage }) => {
          const late =
            card.nextStepDate !== null && card.nextStepDate < today && stage.kind === 'open'
          return (
            <li
              key={card.id}
              className="flex min-h-8 items-center gap-3 px-2 py-1 transition-colors hover:bg-ob-hover"
            >
              <button
                type="button"
                onClick={() => onOpen(card.id)}
                className="min-w-0 flex-[2] truncate text-left text-[14px] text-ob-text"
              >
                {card.company}
              </button>
              <span className="w-32 shrink-0 @3xl:w-40">
                <select
                  value={stage.id}
                  aria-label={`Etapa de ${card.company}`}
                  onChange={(e) => onStage(card.id, e.target.value)}
                  className="h-[26px] w-full cursor-pointer truncate rounded-[4px] bg-transparent px-1.5 text-[13px] text-ob-text outline-none hover:bg-ob-active"
                >
                  {data.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="w-24 shrink-0 text-right text-[13px] tabular-nums">
                {money(card.valueUsd)}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-[13px] text-ob-muted @3xl:block">
                {card.contact?.name ?? '—'}
              </span>
              <span
                className={`min-w-0 flex-[1.5] truncate text-[13px] ${late ? 'text-ob-yellow' : 'text-ob-muted'}`}
              >
                {card.nextStep ?? '—'}
              </span>
              <span
                className={`w-24 shrink-0 text-[13px] tabular-nums ${late ? 'text-ob-yellow' : 'text-ob-muted'}`}
              >
                {card.nextStepDate ? shortDate(card.nextStepDate) : '—'}
              </span>
              <span className="hidden w-24 shrink-0 text-[13px] text-ob-muted tabular-nums @3xl:block">
                {shortDate(card.updatedAt)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
