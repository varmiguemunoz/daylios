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
    <div className="@container mt-2 overflow-hidden rounded-md bg-surface">
      <div className="flex items-center gap-3 px-4 py-2.5 text-micro font-bold text-milk-soft shadow-[inset_0_-1px_0_var(--color-hairline)]">
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
            className={`items-center gap-1 truncate hover:text-milk ${c.wide ? 'hidden @3xl:flex' : 'flex'} ${c.className} ${c.key === 'value' ? 'justify-end' : ''}`}
          >
            {c.label}
            {sort.key === c.key &&
              (sort.dir === 1 ? (
                <ArrowUp size={12} strokeWidth={2.75} />
              ) : (
                <ArrowDown size={12} strokeWidth={2.75} />
              ))}
          </button>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="px-4 py-4 text-caption text-milk-soft">Ningún prospecto coincide.</p>
      )}
      <ul className="[&>li+li]:shadow-[inset_0_1px_0_var(--color-hairline)]">
        {rows.map(({ card, stage }) => {
          const late =
            card.nextStepDate !== null && card.nextStepDate < today && stage.kind === 'open'
          return (
            <li
              key={card.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-raised"
            >
              <button
                type="button"
                onClick={() => onOpen(card.id)}
                className="min-w-0 flex-[2] truncate text-left text-list font-bold"
              >
                {card.company}
              </button>
              <span className="w-32 shrink-0 @3xl:w-40">
                <select
                  value={stage.id}
                  aria-label={`Etapa de ${card.company}`}
                  onChange={(e) => onStage(card.id, e.target.value)}
                  className="h-8 w-full cursor-pointer truncate rounded-full bg-surface-raised px-3 text-micro font-bold text-milk outline-none"
                >
                  {data.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="w-24 shrink-0 text-right text-caption tabular-nums">
                {money(card.valueUsd)}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-caption text-milk-soft @3xl:block">
                {card.contact?.name ?? '—'}
              </span>
              <span
                className={`min-w-0 flex-[1.5] truncate text-caption ${late ? 'text-butter' : 'text-milk-soft'}`}
              >
                {card.nextStep ?? '—'}
              </span>
              <span
                className={`w-24 shrink-0 text-caption tabular-nums ${late ? 'text-butter' : 'text-milk-soft'}`}
              >
                {card.nextStepDate ? shortDate(card.nextStepDate) : '—'}
              </span>
              <span className="hidden w-24 shrink-0 text-caption text-milk-soft tabular-nums @3xl:block">
                {shortDate(card.updatedAt)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
