import { useEffect, useMemo, useState } from 'react'
import { AlignLeft, Check } from 'lucide-react'
import { addDays, DAILY_LIMIT, type DayKey, type HistoryPage, type Task } from '@shared/tasks'
import { tasksApi } from '../lib/api'
import { relativeDay } from '../lib/format'
import { Meter } from './Meter'
import { DayHeading } from './DayHeading'
import { Pager } from './Pager'
import { Markdown } from './Markdown'

type Period = '7' | '30' | 'month' | 'all' | 'range'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'all', label: 'Todo' },
  { id: 'range', label: 'Rango' }
]

const PAGE_SIZE = 7

function bounds(
  period: Period,
  today: DayKey,
  range: { from: DayKey; to: DayKey }
): { from?: DayKey; to?: DayKey } {
  switch (period) {
    case '7':
      return { from: addDays(today, -6), to: today }
    case '30':
      return { from: addDays(today, -29), to: today }
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'range': {
      const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from]
      return { from: from || undefined, to: to || undefined }
    }
    default:
      return { to: today }
  }
}

interface HistoryViewProps {
  today: DayKey
  onOpenTask: (task: Task) => void
}

export function HistoryView({ today, onOpenTask }: HistoryViewProps): React.JSX.Element {
  const [period, setPeriod] = useState<Period>('30')
  const [range, setRange] = useState({ from: addDays(today, -13), to: today })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistoryPage | null>(null)
  const [error, setError] = useState(false)

  const q = useMemo(() => bounds(period, today, range), [period, today, range])

  useEffect(() => {
    let alive = true
    tasksApi
      .history({ ...q, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setData(res)
        setError(false)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [q, page])

  const choose = (p: Period): void => {
    setPeriod(p)
    setPage(1)
  }

  const rate = data && data.totalTasks ? Math.round((data.doneTasks / data.totalTasks) * 100) : 0

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-headline font-extrabold">Historial</h1>
          {data && data.totalTasks > 0 && (
            <p className="text-caption font-semibold text-milk-soft">
              {data.doneTasks}/{data.totalTasks} hechas · {rate}%
            </p>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Periodo"
          className="no-scrollbar -mx-1 mt-4 flex gap-1 overflow-x-auto px-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              onClick={() => choose(p.id)}
              className={`h-9 shrink-0 rounded-full px-3 text-caption font-bold transition-colors ${
                period === p.id
                  ? 'bg-apricot text-ink'
                  : 'bg-surface text-milk-soft hover:bg-surface-raised hover:text-milk'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'range' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['from', 'to'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 rounded-sm bg-surface px-3 py-2">
                <span className="text-micro font-bold text-milk-soft">
                  {k === 'from' ? 'Desde' : 'Hasta'}
                </span>
                <input
                  type="date"
                  value={range[k]}
                  max={today}
                  onChange={(e) => {
                    setRange((r) => ({ ...r, [k]: e.target.value }))
                    setPage(1)
                  }}
                  className="bg-transparent text-caption font-semibold outline-none"
                />
              </label>
            ))}
          </div>
        )}
      </header>

      <main className="scroll-area fade-bottom mt-4 min-h-0 flex-1 overflow-y-auto pb-6 pl-6">
        {error && (
          <p role="alert" className="rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            No pude cargar el historial. Cambia de periodo para reintentar.
          </p>
        )}

        {data && data.days.length === 0 && !error && (
          <div className="px-1 pt-6">
            <p className="text-label font-bold">Nada en este periodo.</p>
            <p className="mt-1 text-caption text-milk-soft">
              Prueba con un rango más amplio o con «Todo».
            </p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          {data?.days.map(({ date, tasks }) => {
            const done = tasks.filter((t) => t.done).length
            return (
              <section key={date} aria-label={relativeDay(date, today)}>
                <DayHeading
                  aside={
                    <div className="flex items-center gap-2.5">
                      <Meter done={done} total={Math.min(tasks.length, DAILY_LIMIT)} size="sm" />
                      <span className="w-8 text-right text-caption font-bold text-milk-soft">
                        {done}/{tasks.length}
                      </span>
                    </div>
                  }
                >
                  {relativeDay(date, today)}
                </DayHeading>
                <ul className="overflow-hidden rounded-md bg-surface">
                  {tasks.map((t, i) => (
                    <li
                      key={t.id}
                      className={i > 0 ? 'shadow-[inset_0_1px_0_var(--color-hairline)]' : ''}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTask(t)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-offset-[-2px] hover:bg-surface-raised focus-visible:bg-surface-raised"
                      >
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full ${
                            t.done
                              ? 'bg-mint text-ink'
                              : 'shadow-[inset_0_0_0_1.5px_var(--color-milk-faint)]'
                          }`}
                          aria-label={t.done ? 'Hecha' : 'Sin hacer'}
                        >
                          {t.done && <Check size={12} strokeWidth={3.5} />}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-list ${
                            t.done ? 'text-milk' : 'text-milk-soft'
                          }`}
                          title={t.title}
                        >
                          <Markdown text={t.title} inline />
                        </span>
                        {t.description && (
                          <AlignLeft
                            size={13}
                            strokeWidth={2.5}
                            className="shrink-0 text-milk-soft"
                            aria-label="Tiene descripción"
                          />
                        )}
                        {t.carriedFrom && (
                          <span className="shrink-0 text-micro font-bold text-butter/80">
                            arrastrada
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </main>

      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  )
}
