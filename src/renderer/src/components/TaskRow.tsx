import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import type { Task } from '@shared/tasks'

interface TaskRowProps {
  task: Task
  onToggle: () => void
  onRename: (title: string) => void
  onRemove: () => void
}

/** Mueve el foco a la fila anterior/siguiente, o al campo de captura desde la primera. */
function focusSibling(from: HTMLElement, dir: 1 | -1): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')]
  const i = rows.indexOf(from)
  const next = rows[i + dir]
  if (next) next.focus()
  else if (dir === -1) document.getElementById('capture')?.focus()
}

export function TaskRow({
  task,
  onToggle,
  onRename,
  onRemove
}: TaskRowProps): React.JSX.Element {
  // Recién creada = animar la entrada. useState con función: se calcula una sola vez al montar.
  const [fresh] = useState(() => Date.now() - Date.parse(task.createdAt) < 2000)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const rowRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEdit = (): void => {
    setDraft(task.title)
    setEditing(true)
  }

  const commit = (): void => {
    setEditing(false)
    if (draft.trim()) onRename(draft)
    rowRef.current?.focus()
  }

  const cancel = (): void => {
    setEditing(false)
    setDraft(task.title)
    rowRef.current?.focus()
  }

  const onRowKey = (e: React.KeyboardEvent<HTMLLIElement>): void => {
    if (editing || e.target !== e.currentTarget) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        onToggle()
        break
      case 'Enter':
        e.preventDefault()
        startEdit()
        break
      case 'Backspace':
      case 'Delete': {
        e.preventDefault()
        const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')]
        const i = rows.indexOf(e.currentTarget)
        onRemove()
        // Mantener el foco en un vecino tras borrar
        requestAnimationFrame(() => {
          const after = [...document.querySelectorAll<HTMLElement>('[data-row]')]
          ;(after[i] ?? after[i - 1] ?? document.getElementById('capture'))?.focus()
        })
        break
      }
      case 'ArrowDown':
        e.preventDefault()
        focusSibling(e.currentTarget, 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusSibling(e.currentTarget, -1)
        break
    }
  }

  return (
    <li
      ref={rowRef}
      data-row
      tabIndex={0}
      onKeyDown={onRowKey}
      aria-label={`${task.title}${task.done ? ', hecha' : ''}`}
      className={`group flex min-h-[46px] items-center gap-3 rounded-md bg-surface py-1 pr-1.5 pl-3.5 transition-colors outline-offset-0 hover:bg-surface-raised focus-visible:bg-surface-raised ${
        fresh ? 'row-in' : ''
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggle}
        aria-label={task.done ? 'Marcar como pendiente' : 'Completar'}
        className={`grid size-[26px] shrink-0 place-items-center rounded-full transition-[background-color,box-shadow,transform] duration-200 active:scale-90 ${
          task.done
            ? 'bg-mint text-ink'
            : 'shadow-[inset_0_0_0_2px_var(--color-milk-faint)] hover:shadow-[inset_0_0_0_2px_var(--color-apricot)]'
        }`}
      >
        {task.done && <Check size={16} strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={200}
          aria-label="Editar tarea"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              cancel()
            }
          }}
          className="min-w-0 flex-1 rounded-sm bg-night px-2 py-1 -mx-2 text-body outline-none"
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col" onDoubleClick={startEdit}>
          <span
            className={`truncate transition-colors duration-300 ${
              task.done ? 'text-milk-soft line-through decoration-milk-soft/50' : 'text-milk'
            }`}
            title={task.title}
          >
            {task.title}
          </span>
          {task.carriedFrom && !task.done && (
            <span className="text-micro leading-tight font-semibold text-butter/80">de ayer</span>
          )}
        </div>
      )}

      {!editing && (
        <div className="hidden shrink-0 items-center group-focus-within:flex group-hover:flex">
          <button
            type="button"
            tabIndex={-1}
            onClick={startEdit}
            aria-label="Editar"
            title="Editar (⏎)"
            className="grid size-8 place-items-center rounded-full text-milk-soft hover:bg-hairline hover:text-milk"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={onRemove}
            aria-label="Eliminar"
            title="Eliminar (⌫)"
            className="grid size-8 place-items-center rounded-full text-milk-soft hover:bg-rose/15 hover:text-rose"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </li>
  )
}
