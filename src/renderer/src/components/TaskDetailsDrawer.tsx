import type { Task, TaskPatch } from '@shared/tasks'
import type { SubtasksState } from '../lib/useSubtasks'
import { Drawer } from '../ui'
import { EffortPicker } from './EffortPicker'
import { TaskTagEditor } from './TaskTagEditor'
import { SubtaskList } from './SubtaskList'

interface TaskDetailsDrawerProps {
  open: boolean
  onClose: () => void
  task: Task
  onUpdate: (patch: TaskPatch) => void
  /** Ausente en una subtarea: el panel no muestra la sección. */
  subtasks?: SubtasksState
  onOpenSubtask: (sub: Task) => void
  onRemoveSubtask: (sub: Task) => void
}

/** Panel derecho del detalle: esfuerzo, tags y subtareas. Fuera de la pantalla principal para que no haga ruido. */
export function TaskDetailsDrawer({
  open,
  onClose,
  task,
  onUpdate,
  subtasks,
  onOpenSubtask,
  onRemoveSubtask
}: TaskDetailsDrawerProps): React.JSX.Element {
  return (
    <Drawer open={open} title="Detalles" onClose={onClose}>
      <div className="flex flex-col gap-6 pt-1">
        <Group label="Esfuerzo">
          <EffortPicker effort={task.effort} onChange={(effort) => onUpdate({ effort })} />
        </Group>
        <Group label="Tags">
          <TaskTagEditor tags={task.tags} onChange={(tags) => onUpdate({ tags })} />
        </Group>
        {subtasks && (
          <SubtaskList
            subtasks={subtasks.subtasks}
            parentDone={task.done}
            onAdd={subtasks.add}
            onToggle={subtasks.toggle}
            onOpen={onOpenSubtask}
            onRemove={(sub) => {
              subtasks.drop(sub)
              onRemoveSubtask(sub)
            }}
            onReorder={subtasks.reorder}
            onCompleteAll={subtasks.completeAll}
          />
        )}
        {subtasks?.error && (
          <p role="alert" className="rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            {subtasks.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

function Group({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-2 text-caption font-extrabold text-milk-soft">{label}</h3>
      {children}
    </section>
  )
}
