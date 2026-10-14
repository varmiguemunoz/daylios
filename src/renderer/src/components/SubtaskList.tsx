import { useState } from 'react'
import { CheckCheck, CornerDownLeft, Plus } from 'lucide-react'
import type { Task } from '@shared/tasks'
import { TaskRow } from './TaskRow'
import { finalIndex, useReorder } from '../lib/useReorder'

interface SubtaskListProps {
  subtasks: Task[]
  /** La madre está hecha: si quedan pendientes se ofrece completarlas. */
  parentDone: boolean
  onAdd: (title: string) => Promise<boolean>
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  onRemove: (task: Task) => void
  /** Mueve la subtarea `id` a la posición `index`. */
  onReorder: (id: string, index: number) => void
  onCompleteAll: () => void
}

export const SUBTASK_CAPTURE = 'subtask-capture'

/**
 * Subtareas de una tarea: captura pequeña (#tags, !esfuerzo) y la lista de siempre a menor escala.
 * Arrastrar o ⌥↑/⌥↓ para ordenar; clic o Enter abre la subtarea.
 */
export function SubtaskList({
  subtasks,
  parentDone,
  onAdd,
  onToggle,
  onOpen,
  onRemove,
  onReorder,
  onCompleteAll
}: SubtaskListProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const done = subtasks.filter((t) => t.done).length
  const pending = subtasks.length - done

  const drag = useReorder((id, index) => {
    const from = subtasks.findIndex((t) => t.id === id)
    if (from >= 0) onReorder(id, finalIndex(index, from))
  })

  const lineAt = (i: number): 'before' | 'after' | null => {
    const t = drag.target
    if (!drag.dragging || !t) return null
    if (t.index === i) return 'before'
    if (i === subtasks.length - 1 && t.index === subtasks.length) return 'after'
    return null
  }

  const submit = async (): Promise<void> => {
    if (!draft.trim()) return
    if (await onAdd(draft)) setDraft('')
  }

  return (
    <section aria-label="Subtareas">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-caption font-extrabold text-milk-soft">
          Subtareas
          {subtasks.length > 0 && (
            <span className="ml-1.5 tabular-nums">
              {done}/{subtasks.length}
            </span>
          )}
        </h2>
        {parentDone && pending > 0 && (
          <button
            type="button"
            onClick={onCompleteAll}
            className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-micro font-bold text-milk transition-colors hover:bg-surface-raised"
          >
            <CheckCheck size={14} className="text-mint" />
            Completar {pending === 1 ? 'la pendiente' : `las ${pending} pendientes`}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="flex h-12 items-center gap-2.5 rounded-md bg-surface px-4 focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]">
          <Plus size={16} strokeWidth={2.75} className="shrink-0 text-apricot" aria-hidden />
          <input
            id={SUBTASK_CAPTURE}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && subtasks.length) {
                e.preventDefault()
                document.querySelector<HTMLElement>('[data-row]')?.focus()
              }
            }}
            placeholder="Añadir subtarea · #tag !alto"
            aria-label="Nueva subtarea"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-list outline-none placeholder:text-milk-soft"
          />
          {draft.trim() && (
            <span
              className="grid size-7 place-items-center rounded-full bg-apricot text-ink"
              aria-hidden
            >
              <CornerDownLeft size={13} strokeWidth={2.75} />
            </span>
          )}
        </label>
      </form>

      {subtasks.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1" {...drag.zone('subtasks', subtasks.length)}>
          {subtasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              size="compact"
              captureId={SUBTASK_CAPTURE}
              onToggle={() => onToggle(task)}
              onOpen={() => onOpen(task)}
              onRemove={() => onRemove(task)}
              onMoveBy={(delta) => onReorder(task.id, i + delta)}
              drag={drag.item(task.id, i, 'subtasks')}
              dragging={drag.dragging === task.id}
              dropLine={lineAt(i)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
