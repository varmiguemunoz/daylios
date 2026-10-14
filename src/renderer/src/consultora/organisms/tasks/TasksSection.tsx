import { useCallback, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { todayKey, type Task, type TaskRecordKind } from '@shared/tasks'
import { errorMessage, tasksApi } from '../../../lib/api'
import { useLoad } from '../../lib'
import { Button, Empty, ErrorNote, INPUT, List, Section } from '../../ui'
import { TaskMeta } from './TaskCard'
import { TaskDrawer } from './TaskDrawer'
import { isDayFull } from './lib'

const LINK_FIELD: Record<TaskRecordKind, 'client' | 'project' | 'prospect'> = {
  client: 'client',
  project: 'project',
  prospect: 'prospect'
}

export function TasksSection({
  kind,
  id
}: {
  kind: TaskRecordKind
  id: string
}): React.JSX.Element {
  const today = todayKey()
  const load = useCallback(() => tasksApi.forRecord(kind, id), [kind, id])
  const { data, error: loadError, reload } = useLoad(load)
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)
  const close = useCallback(() => setOpen(null), [])

  const create = async (): Promise<void> => {
    if (!draft?.trim()) return setDraft(null)
    try {
      const task = await tasksApi.add(today, draft.trim())
      await tasksApi.update(task.id, { [LINK_FIELD[kind]]: id })
      setDraft(null)
      setError(null)
      await reload()
    } catch (e) {
      const message = errorMessage(e)
      setError(isDayFull(message) ? `${message} Créala desde Tareas en otro día.` : message)
    }
  }

  const toggle = async (task: Task): Promise<void> => {
    try {
      await tasksApi.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Section
      title="Tareas"
      aside={
        <Button onClick={() => setDraft('')}>
          <Plus size={15} />
          Nueva
        </Button>
      }
    >
      {draft !== null && (
        <form
          className="mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(null)
              }
            }}
            placeholder="Título y Enter · se crea para hoy"
            aria-label="Título de la tarea"
            className={INPUT}
          />
        </form>
      )}
      <ErrorNote message={error ?? loadError} />
      {data && data.length === 0 ? (
        <Empty title="Sin tareas." hint="Crea una aquí o relaciónala desde su detalle en Tareas." />
      ) : (
        <List>
          {(data ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 px-2 transition-colors hover:bg-ob-hover"
            >
              <button
                type="button"
                aria-label={t.status === 'done' ? 'Reabrir' : 'Marcar hecha'}
                onClick={() => void toggle(t)}
                className={`grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors ${
                  t.status === 'done'
                    ? 'border-ob-accent bg-ob-accent text-white'
                    : 'border-ob-faint hover:border-ob-accent'
                }`}
              >
                {t.status === 'done' && <Check size={11} strokeWidth={3} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="flex min-h-8 min-w-0 flex-1 flex-col justify-center py-1.5 text-left"
              >
                <span
                  className={`truncate text-[14px] ${
                    t.status === 'done'
                      ? 'text-ob-muted line-through decoration-ob-faint'
                      : 'text-ob-text'
                  }`}
                >
                  {t.title}
                </span>
                <TaskMeta task={t} today={today} />
              </button>
              {t.status === 'doing' && (
                <span className="shrink-0 rounded-full bg-ob-accent/15 px-2 text-[12px] text-ob-link">
                  En curso
                </span>
              )}
            </li>
          ))}
        </List>
      )}
      {open && (
        <TaskDrawer
          key={open.id}
          task={open}
          today={today}
          onClose={close}
          onChanged={() => void reload()}
        />
      )}
    </Section>
  )
}
