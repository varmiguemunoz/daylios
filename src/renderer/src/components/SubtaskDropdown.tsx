import type { Task } from '@shared/tasks'
import { useSubtasks } from '../lib/useSubtasks'
import { finalIndex, useReorder } from '../lib/useReorder'
import { TaskRow } from './TaskRow'

interface SubtaskDropdownProps {
  parent: Task
  /** Sube cuando el día se recarga (deshacer, Claude): vuelve a leer. */
  revision: number
  onOpen: (sub: Task) => void
  /** Borra con «Deshacer» (useDay). */
  onRemove: (sub: Task) => void
  /** La madre recalcula su «2/5». */
  onChange: (subtasks: Task[]) => void
}

/**
 * Subtareas desplegadas debajo de su madre en Hoy: filas compactas alineadas al texto de la madre.
 * Va en su propio `<li>` para no alterar los índices de arrastre de las madres, y con su propio
 * grupo de arrastre: una subtarea no sale de su madre.
 */
export function SubtaskDropdown({
  parent,
  revision,
  onOpen,
  onRemove,
  onChange
}: SubtaskDropdownProps): React.JSX.Element {
  const subs = useSubtasks(parent.id, revision, onChange)
  const list = subs.subtasks
  const group = `sub:${parent.id}`

  const drag = useReorder((id, index) => {
    const from = list.findIndex((t) => t.id === id)
    if (from >= 0) subs.reorder(id, finalIndex(index, from))
  })

  const lineAt = (i: number): 'before' | 'after' | null => {
    const t = drag.target
    if (!drag.dragging || !t) return null
    if (t.index === i) return 'before'
    if (i === list.length - 1 && t.index === list.length) return 'after'
    return null
  }

  return (
    <li className="row-in pl-[38px]" aria-label={`Subtareas de ${parent.title}`}>
      {subs.error && (
        <p className="px-3.5 py-1 text-micro font-semibold text-coral">{subs.error}</p>
      )}
      <ul className="flex flex-col gap-1" {...drag.zone(group, list.length)}>
        {list.map((sub, i) => (
          <TaskRow
            key={sub.id}
            task={sub}
            size="compact"
            onToggle={() => subs.toggle(sub)}
            onOpen={() => onOpen(sub)}
            onRemove={() => {
              subs.drop(sub)
              onRemove(sub)
            }}
            onMoveBy={(delta) => subs.reorder(sub.id, i + delta)}
            drag={drag.item(sub.id, i, group)}
            dragging={drag.dragging === sub.id}
            dropLine={lineAt(i)}
          />
        ))}
      </ul>
    </li>
  )
}
