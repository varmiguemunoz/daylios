import { SlidersHorizontal } from 'lucide-react'
import type { Task } from '@shared/tasks'
import { EffortBars, TagChips } from './TaskMeta'
import { SubtaskProgress } from './SubtaskProgress'
import { kbd } from '../lib/platform'

export function TaskSummary({
  task,
  onOpen
}: {
  task: Task
  onOpen: () => void
}): React.JSX.Element {
  const empty = !task.effort && !task.tags.length && !task.subtasks?.total
  return (
    <button
      type="button"
      onClick={onOpen}
      title={kbd('Esfuerzo, tags y subtareas (⌘I)')}
      className="-mx-2 flex min-h-8 max-w-full items-center gap-2 rounded-full px-2 text-left transition-colors hover:bg-surface"
    >
      {empty ? (
        <span className="flex items-center gap-1.5 text-caption text-milk-soft">
          <SlidersHorizontal size={13} strokeWidth={2.5} aria-hidden />
          Añadir esfuerzo, tags o subtareas
        </span>
      ) : (
        <>
          <EffortBars effort={task.effort} />
          <SubtaskProgress progress={task.subtasks} />
          <span className="min-w-0 overflow-hidden">
            <TagChips tags={task.tags} />
          </span>
        </>
      )}
    </button>
  )
}
