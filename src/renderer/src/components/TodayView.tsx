import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, Plus } from 'lucide-react'
import { DAILY_LIMIT, type DayKey, type Task } from '@shared/tasks'
import type { DayState } from '../lib/useDay'
import { longDate, plural, weekdayName } from '../lib/format'
import { onWindowShown } from '../lib/api'
import { Meter } from './Meter'
import { TaskRow } from './TaskRow'
import { YesterdayTray } from './YesterdayTray'

interface TodayViewProps {
  date: DayKey
  day: DayState
  onOpenTask: (task: Task) => void
}

function statusLine(done: number, total: number): string {
  const free = DAILY_LIMIT - total
  if (total === 0) return 'Día en blanco · 8 huecos libres'
  if (done >= DAILY_LIMIT) return 'Día completo. Buen trabajo.'
  if (free === 0) return `${DAILY_LIMIT} planificadas · día lleno`
  const slots = plural(free, 'hueco libre', 'huecos libres')
  if (done > 0 && done === total) return `Todo hecho · ${slots}`
  return `${plural(total, 'planificada', 'planificadas')} · ${slots}`
}

export function TodayView({ date, day, onOpenTask }: TodayViewProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const total = day.today.length
  const done = day.today.filter((t) => t.done).length

  // Foco al campo de captura al abrir la ventana: escribir es lo primero.
  useEffect(() => {
    inputRef.current?.focus()
    return onWindowShown(() => inputRef.current?.focus())
  }, [])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (await day.add(draft)) setDraft('')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div className="pb-1">
            <h1 className="text-label font-extrabold text-milk">{weekdayName(date)}</h1>
            <p className="text-caption text-milk-soft">{longDate(date)}</p>
          </div>
          <p
            className="flex items-baseline font-extrabold"
            aria-label={`${done} de ${DAILY_LIMIT} tareas hechas`}
          >
            <span key={done} className="tick text-display text-milk">
              {done}
            </span>
            <span className="text-headline text-milk-faint">/{DAILY_LIMIT}</span>
          </p>
        </div>

        <div className="mt-4">
          <Meter done={done} total={total} />
        </div>
        <p className="mt-2.5 text-caption font-semibold text-milk-soft" aria-live="polite">
          <span key={`${done}-${total}`} className="tick">
            {statusLine(done, total)}
          </span>
        </p>

        <form onSubmit={submit} className="mt-5">
          <label
            className={`flex h-[60px] items-center gap-3 rounded-lg px-5 transition-[box-shadow,background-color] ${
              day.full
                ? 'bg-surface/50'
                : 'bg-surface focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]'
            }`}
          >
            <Plus
              size={20}
              strokeWidth={2.5}
              className={day.full ? 'text-milk-faint' : 'text-apricot'}
              aria-hidden
            />
            <input
              id="capture"
              ref={inputRef}
              value={draft}
              maxLength={200}
              disabled={day.full}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  document.querySelector<HTMLElement>('[data-row]')?.focus()
                } else if (e.key === 'Escape' && draft) {
                  // Primer Esc limpia el borrador; el segundo cierra la ventana.
                  e.preventDefault()
                  e.stopPropagation()
                  setDraft('')
                }
              }}
              placeholder={day.full ? 'Día lleno · 8 de 8' : 'Añade una tarea…'}
              aria-label="Nueva tarea"
              className="min-w-0 flex-1 bg-transparent text-body outline-none disabled:cursor-not-allowed"
            />
            {draft.trim() && (
              <span
                className="grid size-8 place-items-center rounded-full bg-apricot text-ink"
                aria-hidden
              >
                <CornerDownLeft size={15} strokeWidth={2.75} />
              </span>
            )}
          </label>
        </form>
      </header>

      <main className="scroll-area mt-3 min-h-0 flex-1 overflow-y-auto pb-3 pl-6">
        {day.error && (
          <p role="alert" className="mb-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            {day.error}
          </p>
        )}

        <YesterdayTray
          tasks={day.leftovers}
          full={day.full}
          room={DAILY_LIMIT - total}
          onBring={(t) => void day.bringToday(t)}
          onBringAll={() => void day.bringAll()}
          onDismiss={(t) => void day.dismiss(t)}
        />

        {!day.loading && total === 0 && (
          <div className="px-1 pt-4 pb-2">
            <p className="text-label font-bold text-milk">Un día, ocho huecos.</p>
            <p className="mt-1 text-caption text-milk-soft">
              Escribe arriba lo más importante y pulsa{' '}
              <kbd className="inline-grid size-5 translate-y-[3px] place-items-center rounded-[6px] bg-surface-raised text-milk">
                <CornerDownLeft size={12} strokeWidth={2.75} aria-label="Intro" />
              </kbd>
              . Lo que completes se llena de menta.
            </p>
          </div>
        )}

        {total > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Tareas de hoy">
            {day.today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => void day.toggle(task)}
                onOpen={() => onOpenTask(task)}
                onRemove={() => void day.remove(task)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
