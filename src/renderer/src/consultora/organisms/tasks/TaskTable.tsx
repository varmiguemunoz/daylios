import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  isOverdue,
  type DayKey,
  type Task,
  type TaskStatus
} from '@shared/tasks'
import { Markdown } from '../../../components/Markdown'
import { useUiState } from '../../../lib/ui-state'
import { Table, type Column, type TableSort } from '../../molecules/Table'
import { dayLabel, linkName } from './lib'
import { freshClass, useFresh } from '../live/RemoteChanges'

export function TaskTable({
  tasks,
  today,
  onOpen,
  onStatus
}: {
  tasks: Task[]
  today: DayKey
  onOpen: (task: Task) => void
  onStatus: (task: Task, status: TaskStatus) => void
}): React.JSX.Element {
  const [sort, setSort] = useUiState<TableSort | null>('tasks.sort', null, isSort)
  const fresh = useFresh('tasks')
  const columns: Column<Task>[] = [
    {
      key: 'title',
      label: 'Tarea',
      width: '40%',
      sortValue: (t) => t.title.toLowerCase(),
      render: (t) => (
        <span
          className={t.status === 'done' ? 'text-ob-muted line-through decoration-ob-faint' : ''}
        >
          <Markdown text={t.title} inline />
        </span>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      width: '130px',
      sortValue: (t) => TASK_STATUSES.indexOf(t.status),
      render: (t) => (
        <select
          value={t.status}
          aria-label={`Estado de ${t.title}`}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatus(t, e.target.value as TaskStatus)}
          className="h-[26px] w-full cursor-pointer rounded-[4px] bg-transparent px-1.5 text-[13px] text-ob-text outline-none hover:bg-ob-active"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'date',
      label: 'Día',
      width: '120px',
      sortValue: (t) => `${t.date}:${String(t.position).padStart(4, '0')}`,
      render: (t) => (
        <span className={isOverdue(t, today) ? 'text-ob-yellow' : ''}>
          {dayLabel(t.date, today)}
        </span>
      )
    },
    {
      key: 'effort',
      label: 'Esfuerzo',
      width: '90px',
      hideBelow: 'md',
      sortValue: (t) => EFFORT_RANK[t.effort ?? ''] ?? 3,
      render: (t) => t.effort ?? ''
    },
    {
      key: 'tags',
      label: 'Tags',
      hideBelow: 'lg',
      sortValue: (t) => t.tags.join(' '),
      render: (t) => (
        <span className="text-ob-link">{t.tags.map((tag) => `#${tag}`).join(' ')}</span>
      )
    },
    {
      key: 'link',
      label: 'Relación',
      hideBelow: 'md',
      sortValue: (t) => (linkName(t) ?? '\uffff').toLowerCase(),
      render: (t) => linkName(t) ?? ''
    },
    {
      key: 'progress',
      label: 'Avance',
      width: '80px',
      align: 'right',
      sortValue: (t) => (t.subtasks?.total ? t.subtasks.done / t.subtasks.total : -1),
      render: (t) => (t.subtasks?.total ? `${t.subtasks.done}/${t.subtasks.total}` : '')
    }
  ]
  return (
    <Table
      label="Tareas"
      columns={columns}
      rows={tasks}
      rowKey={(t) => t.id}
      onOpen={onOpen}
      sort={sort}
      onSort={setSort}
      rowClass={(t) => freshClass(fresh(t.id))}
    />
  )
}

const EFFORT_RANK: Record<string, number> = { alto: 0, medio: 1, bajo: 2 }

const isSort = (v: unknown): v is TableSort | null =>
  v === null ||
  (typeof v === 'object' &&
    typeof (v as TableSort).key === 'string' &&
    ((v as TableSort).dir === 'asc' || (v as TableSort).dir === 'desc'))
