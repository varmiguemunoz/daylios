import { useState } from 'react'
import { AlignLeft, Check, Trash2 } from 'lucide-react'
import type { Task } from '@shared/tasks'
import { Markdown } from './Markdown'

interface TaskRowProps {
  task: Task
  onToggle: () => void
  onOpen: () => void
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

/**
 * Fila de tarea. Clic en el texto o Enter abre el detalle; el círculo (o Espacio) la completa.
 * Editar el título y la descripción se hace en el detalle.
 */
export function TaskRow({ task, onToggle, onOpen, onRemove }: TaskRowProps): React.JSX.Element {
  // Recién creada = animar la entrada. useState con función: se calcula una sola vez al montar.
  const [fresh] = useState(() => Date.now() - Date.parse(task.createdAt) < 2000)

  const onRowKey = (e: React.KeyboardEvent<HTMLLIElement>): void => {
    if (e.target !== e.currentTarget) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        onToggle()
        break
      case 'Enter':
        e.preventDefault()
        onOpen()
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
      data-row
      tabIndex={0}
      onKeyDown={onRowKey}
      aria-label={`${task.title}${task.done ? ', hecha' : ''}. Enter para abrir`}
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

      <div className="flex min-w-0 flex-1 cursor-pointer flex-col py-1" onClick={onOpen}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`truncate transition-colors duration-300 ${
              task.done ? 'text-milk-soft line-through decoration-milk-soft/50' : 'text-milk'
            }`}
            title={task.title}
          >
            <Markdown text={task.title} inline />
          </span>
          {task.description && (
            <AlignLeft
              size={14}
              strokeWidth={2.5}
              className="shrink-0 text-milk-soft"
              aria-label="Tiene descripción"
            />
          )}
        </span>
        {task.carriedFrom && !task.done && (
          <span className="text-micro leading-tight font-semibold text-butter/80">de ayer</span>
        )}
      </div>

      <div className="hidden shrink-0 items-center group-focus-within:flex group-hover:flex">
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
    </li>
  )
}
