import { useCallback, useEffect, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import type { DayKey, Task, TaskPatch } from '@shared/tasks'
import { errorMessage, tasksApi } from '../lib/api'
import { longDate, relativeDay } from '../lib/format'
import { useAutosave } from '../lib/useAutosave'
import { BackButton } from './BackButton'
import { Markdown } from './Markdown'
import { MarkdownEditor } from './MarkdownEditor'

interface TaskDetailProps {
  task: Task
  today: DayKey
  /** Nombre de la vista a la que vuelve ("Hoy", "Historial"). */
  backLabel: string
  onBack: () => void
  onRemove: (task: Task) => void
}

/**
 * Detalle de una tarea: título (markdown en línea), hecha/pendiente y descripción en markdown.
 * El título se guarda al salir del campo; la descripción, sola mientras escribes.
 */
export function TaskDetail({
  task: initial,
  today,
  backLabel,
  onBack,
  onRemove
}: TaskDetailProps): React.JSX.Element {
  const [task, setTask] = useState(initial)
  const [description, setDescription] = useState(initial.description ?? '')
  const [draft, setDraft] = useState<string | null>(null) // null = no se está editando el título
  const [error, setError] = useState<string | null>(null)
  const id = initial.id

  const saveDescription = useCallback(
    (text: string) => tasksApi.update(id, { description: text }),
    [id]
  )
  const { status, flush } = useAutosave(description, saveDescription)

  const back = useCallback(async () => {
    await flush()
    onBack()
  }, [flush, onBack])

  // Esc vuelve atrás (guardando antes). El campo de título lo intercepta mientras se edita.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  const update = async (patch: TaskPatch): Promise<void> => {
    try {
      setTask(await tasksApi.update(id, patch))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
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
        <button
          type="button"
          onClick={() => onRemove(task)}
          aria-label="Eliminar tarea"
          title="Eliminar tarea"
          className="grid size-9 place-items-center rounded-full text-milk-soft transition-colors hover:bg-rose/15 hover:text-rose"
        >
          <Trash2 size={17} />
        </button>
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

        <p className="mt-2 flex items-center gap-2 pl-[38px] text-caption text-milk-soft">
          <span>
            {relativeDay(task.date, today)} · {longDate(task.date)}
          </span>
          {task.carriedFrom && !task.done && (
            <span className="text-micro font-semibold text-butter/80">de ayer</span>
          )}
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            {error}
          </p>
        )}
      </section>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          status={status}
          placeholder="Descripción en markdown: pasos, enlaces, `código`, - [ ] casillas…"
          emptyHint="Sin descripción. Pulsa Escribir o ⌘E para añadir una."
        />
      </div>
    </div>
  )
}
