import { ListChecks } from 'lucide-react'
import { isOverdue, type DayKey, type Task } from '@shared/tasks'
import { Markdown } from '../../../components/Markdown'
import { TASK_DRAG, dayLabel, linkName } from './lib'
import { freshClass, useFresh } from '../live/RemoteChanges'

const EFFORT_LABEL = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' } as const

export function TaskMeta({ task, today }: { task: Task; today: DayKey }): React.JSX.Element {
  const late = isOverdue(task, today)
  const link = linkName(task)
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ob-faint">
      <span className={late ? 'text-ob-yellow' : ''}>
        {dayLabel(task.date, today)}
        {late && ' · atrasada'}
      </span>
      {task.effort && <span>{EFFORT_LABEL[task.effort]}</span>}
      {task.subtasks && task.subtasks.total > 0 && (
        <span className="flex items-center gap-1 tabular-nums">
          <ListChecks size={12} aria-hidden />
          {task.subtasks.done}/{task.subtasks.total}
        </span>
      )}
      {task.tags.map((t) => (
        <span key={t} className="text-ob-link">
          #{t}
        </span>
      ))}
      {link && <span className="truncate text-ob-muted">{link}</span>}
    </span>
  )
}

export function TaskCard({
  task,
  today,
  onOpen
}: {
  task: Task
  today: DayKey
  onOpen: () => void
}): React.JSX.Element {
  const fresh = useFresh('tasks')
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG, task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className={`flex flex-col gap-1 rounded-[6px] border border-ob-border bg-ob-bg px-3 py-2.5 text-left transition-colors hover:border-[#4a4a4a] focus-visible:border-ob-accent ${
        task.status === 'done' ? 'opacity-70' : ''
      } ${freshClass(fresh(task.id))}`}
    >
      <span
        className={`text-[14px] leading-snug text-ob-text ${
          task.status === 'done' ? 'line-through decoration-ob-faint' : ''
        }`}
      >
        <Markdown text={task.title} inline />
      </span>
      <TaskMeta task={task} today={today} />
    </button>
  )
}
