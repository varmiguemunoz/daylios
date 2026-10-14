import { useCallback, useEffect, useState } from 'react'
import { Check, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { DayKey, Task, TaskPatch } from '@shared/tasks'
import { errorMessage, tasksApi } from '../lib/api'
import { longDate, relativeDay } from '../lib/format'
import { useAutosave } from '../lib/useAutosave'
import { useSubtasks } from '../lib/useSubtasks'
import { IconButton, isOverlayOpen } from '../ui'
import { BackButton } from './BackButton'
import { Markdown } from './Markdown'
import { MarkdownEditor, fromMarkdownEditor } from './MarkdownEditor'
import { TaskSummary } from './TaskSummary'
import { TaskDetailsDrawer } from './TaskDetailsDrawer'

interface TaskDetailProps {
  task: Task
  today: DayKey

  backLabel: string
  onBack: () => void
  onRemove: (task: Task) => void

  parent?: Pick<Task, 'id' | 'title'>

  revision: number

  onOpenSubtask: (task: Task, self: Task) => void
  onRemoveSubtask: (task: Task) => void
}

export function TaskDetail({
  task: initial,
  today,
  backLabel,
  onBack,
  onRemove,
  parent,
  revision,
  onOpenSubtask,
  onRemoveSubtask
}: TaskDetailProps): React.JSX.Element {
  const [task, setTask] = useState(initial)
  const [description, setDescription] = useState(initial.description ?? '')
  const [draft, setDraft] = useState<string | null>(null) // null = no se está editando el título
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState(false)
  const id = initial.id
  const isSubtask = initial.parentId !== null

  // El «2/5» del resumen sigue a los cambios hechos en el panel.
  const subtasks = useSubtasks(isSubtask ? null : id, revision, (list) =>
    setTask((t) => ({
      ...t,
      subtasks: { total: list.length, done: list.filter((x) => x.done).length }
    }))
  )

  const saveDescription = useCallback(
    (text: string) => tasksApi.update(id, { description: text }),
    [id]
  )
  const { status, flush } = useAutosave(description, saveDescription)

  const back = useCallback(async () => {
    await flush()
    onBack()
  }, [flush, onBack])

  // Esc vuelve atrás (guardando antes), salvo que lo use el editor o el panel. ⌘I abre o cierra el panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setPanel((open) => !open)
      } else if (e.key === 'Escape' && !isOverlayOpen() && !fromMarkdownEditor(e)) {
        void back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  const update = async (patch: TaskPatch): Promise<void> => {
    try {
      const saved = await tasksApi.update(id, patch)
      setTask((t) => ({ ...saved, subtasks: t.subtasks }))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const openSubtask = async (sub: Task): Promise<void> => {
    await flush()
    setPanel(false)
    onOpenSubtask(sub, { ...task, description: description.trim() ? description : null })
  }

  const commitTitle = (): void => {
    const clean = draft?.trim()
    setDraft(null)
    if (clean && clean !== task.title) void update({ title: clean })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-5">
        <BackButton label={backLabel} onClick={() => void back()} />
        <span className="flex items-center gap-1">
          <IconButton
            label="Detalles: esfuerzo, tags y subtareas (⌘I)"
            onClick={() => setPanel(true)}
          >
            <SlidersHorizontal size={16} strokeWidth={2.5} />
          </IconButton>
          <IconButton label="Eliminar tarea" tone="danger" onClick={() => onRemove(task)}>
            <Trash2 size={17} />
          </IconButton>
        </span>
      </header>

      <section className="px-6 pt-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => void update({ done: !task.done })}
            aria-label={task.done ? 'Marcar como pendiente' : 'Completar'}
            className={`mt-px grid size-[26px] shrink-0 place-items-center rounded-full transition-[background-color,box-shadow,transform] duration-200 active:scale-90 ${
              task.done
                ? 'bg-mint text-ink'
                : 'shadow-[inset_0_0_0_2px_var(--color-milk-faint)] hover:shadow-[inset_0_0_0_2px_var(--color-apricot)]'
            }`}
          >
            {task.done && <Check size={16} strokeWidth={3} />}
          </button>

          {draft !== null ? (
            <textarea
              autoFocus
              rows={1}
              value={draft}
              maxLength={200}
              aria-label="Título de la tarea"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitTitle()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setDraft(null)
                }
              }}
              className="-mx-2 -my-0.5 min-w-0 flex-1 resize-none rounded-sm bg-surface px-2 py-0.5 text-title font-extrabold outline-none [field-sizing:content]"
            />
          ) : (
            <h1
              role="button"
              tabIndex={0}
              title="Clic para editar"
              onClick={() => setDraft(task.title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setDraft(task.title)
                }
              }}
              className={`min-w-0 flex-1 cursor-text rounded-sm text-title font-extrabold break-words transition-colors ${
                task.done ? 'text-milk-soft line-through decoration-milk-soft/50' : 'text-milk'
              }`}
            >
              <Markdown text={task.title} inline />
            </h1>
          )}
        </div>

        <div className="pl-[38px]">
          <p className="mt-2 flex items-center gap-2 text-caption text-milk-soft">
            {parent ? (
              <span className="min-w-0 truncate">
                Subtarea de{' '}
                <span className="font-bold text-milk">
                  <Markdown text={parent.title} inline />
                </span>
              </span>
            ) : (
              <span>
                {relativeDay(task.date, today)} · {longDate(task.date)}
              </span>
            )}
            {task.carriedFrom && !task.done && (
              <span className="text-micro font-semibold text-butter/80">de ayer</span>
            )}
          </p>
          <div className="mt-2">
            <TaskSummary task={task} onOpen={() => setPanel(true)} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            {error}
          </p>
        )}
      </section>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          onCommit={flush}
          status={status}
          placeholder="Descripción en markdown: pasos, enlaces, `código`, - [ ] casillas…"
          emptyHint="Sin descripción. Clic para escribir."
        />
      </div>

      <TaskDetailsDrawer
        open={panel}
        onClose={() => setPanel(false)}
        task={task}
        onUpdate={(patch) => void update(patch)}
        subtasks={isSubtask ? undefined : subtasks}
        onOpenSubtask={(sub) => void openSubtask(sub)}
        onRemoveSubtask={onRemoveSubtask}
      />
    </div>
  )
}
