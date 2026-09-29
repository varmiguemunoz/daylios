import { useState } from 'react'
import { ArrowUp, ChevronDown, X } from 'lucide-react'
import type { Task } from '@shared/tasks'
import { plural } from '../lib/format'

interface YesterdayTrayProps {
  tasks: Task[]
  full: boolean
  room: number
  onBring: (task: Task) => void
  onBringAll: () => void
  onDismiss: (task: Task) => void
}

export function YesterdayTray({
  tasks,
  full,
  room,
  onBring,
  onBringAll,
  onDismiss
}: YesterdayTrayProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (tasks.length === 0) return null

  const bringable = Math.min(Math.max(room, 0), tasks.length)

  return (
    <section aria-labelledby="yesterday-title" className="mb-3 rounded-md bg-butter/8">
      <div className="flex h-12 items-center gap-2 pr-1.5 pl-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="yesterday-list"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-3 text-left"
        >
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-butter px-1.5 text-micro font-extrabold text-ink">
            {tasks.length}
          </span>
          <span id="yesterday-title" className="truncate text-caption font-bold text-butter">
            {plural(tasks.length, 'pendiente de ayer', 'pendientes de ayer')}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className={`shrink-0 text-butter/70 transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        <button
          type="button"
          onClick={onBringAll}
          disabled={full}
          title={full ? 'Hoy ya tiene 8 tareas' : undefined}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-butter px-3.5 text-caption font-extrabold text-ink transition-transform active:scale-95 disabled:bg-surface-raised disabled:text-milk-faint"
        >
          <ArrowUp size={15} strokeWidth={2.75} />
          {bringable >= tasks.length || full ? 'Traer' : `Traer ${bringable}`}
        </button>
      </div>

      {open && (
        <ul id="yesterday-list" className="flex flex-col px-1.5 pb-1.5">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex min-h-11 items-center gap-1 rounded-sm py-1 pr-0 pl-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-butter)_12%,transparent)]"
            >
              <span className="min-w-0 flex-1 truncate text-list text-milk" title={task.title}>
                {task.title}
              </span>
              <button
                type="button"
                onClick={() => onBring(task)}
                disabled={full}
                aria-label={`Traer a hoy: ${task.title}`}
                title={full ? 'Hoy ya tiene 8 tareas' : 'Traer a hoy'}
                className="grid size-9 place-items-center rounded-full text-butter hover:bg-butter/15 disabled:text-milk-faint disabled:hover:bg-transparent"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => onDismiss(task)}
                aria-label={`Soltar: ${task.title}`}
                title="Soltar"
                className="grid size-9 place-items-center rounded-full text-milk-soft hover:bg-rose/15 hover:text-rose"
              >
                <X size={17} strokeWidth={2.5} />
              </button>
            </li>
          ))}
          {full && (
            <li className="px-3 pt-1.5 pb-1 text-caption text-milk-soft">
              Hoy ya tiene 8. Termina o suelta algo para hacer sitio.
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
