import { useCallback, useEffect, useState } from 'react'
import { Columns3, List as ListIcon, Plus } from 'lucide-react'
import {
  TASK_PERIODS,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  addDays,
  periodQuery,
  todayKey,
  type DayKey,
  type Task,
  type TaskPeriod,
  type TaskStatus
} from '@shared/tasks'
import { errorMessage, tasksApi } from '../../lib/api'
import { useUiState } from '../../lib/ui-state'
import { useLoad } from '../lib'
import { Button, Drawer, Empty, ErrorNote, FilterButton, INPUT, Page, SegmentedToggle } from '../ui'
import { Chips } from '../marketing-ui'
import { useAccount } from '../organisms/account/useAccount'
import { useOrgs } from '../organisms/orgs/useOrgs'
import { KanbanAddField, KanbanColumn } from '../organisms/kanban/KanbanColumn'
import { TaskCard } from '../organisms/tasks/TaskCard'
import { TaskDrawer } from '../organisms/tasks/TaskDrawer'
import { TaskFiltersPanel } from '../organisms/tasks/TaskFiltersPanel'
import { TaskTable } from '../organisms/tasks/TaskTable'
import {
  EMPTY_TASK_FILTERS,
  TASK_DRAG,
  activeTaskFilters,
  filterQuery,
  isDayFull,
  isTaskFilters,
  nextFreeDay,
  type TaskFilters
} from '../organisms/tasks/lib'

type View = 'board' | 'list'

const DOT: Partial<Record<TaskStatus, 'green'>> = { done: 'green' }

export function Tasks({ openId }: { openId?: string }): React.JSX.Element {
  const today = todayKey()
  const account = useAccount()
  const { active } = useOrgs()
  const me = active.orgId ? (account.user?.id ?? null) : null
  const [view, setView] = useUiState<View>(
    'tasks.view',
    'board',
    (v) => v === 'board' || v === 'list'
  )
  const [period, setPeriod] = useUiState<TaskPeriod>('tasks.period', 'week', (v) =>
    TASK_PERIODS.some((p) => p.id === v)
  )
  const [range, setRange] = useUiState(
    'tasks.range',
    { from: today, to: addDays(today, 6) },
    (v) => !!v && typeof (v as { from?: unknown }).from === 'string'
  )
  const [filters, setFilters] = useUiState<TaskFilters>(
    'tasks.filters',
    EMPTY_TASK_FILTERS,
    isTaskFilters
  )
  const [panel, setPanel] = useState(false)
  const [open, setOpen] = useState<Task | null>(null)
  const closeTask = useCallback(() => setOpen(null), [])
  useEffect(() => {
    if (!openId) return
    let alive = true
    tasksApi
      .get(openId)
      .then((v) => alive && setOpen(v.task))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [openId])
  const [adding, setAdding] = useState<TaskStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState<{ title: string; date: DayKey } | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggest, setSuggest] = useState<{
    title: string
    status: TaskStatus
    date: DayKey
  } | null>(null)

  const load = useCallback(
    () => tasksApi.board({ ...periodQuery(period, today, range), ...filterQuery(filters, me) }),
    [period, today, range, filters, me]
  )
  const { data, error: loadError, reload } = useLoad(load)
  const tasks = data ?? []
  const openOnly = period === 'overdue' || period === 'open'

  const create = async (title: string, status: TaskStatus, date: DayKey): Promise<boolean> => {
    if (!title.trim()) return false
    try {
      const task = await tasksApi.add(date, title.trim())
      if (status !== 'todo') await tasksApi.update(task.id, { status })
      setError(null)
      setSuggest(null)
      await reload()
      return true
    } catch (e) {
      const message = errorMessage(e)
      if (isDayFull(message)) {
        const free = await nextFreeDay(addDays(date, 1))
        setSuggest(free ? { title: title.trim(), status, date: free } : null)
      }
      setError(message)
      return false
    }
  }

  const move = async (id: string, status: TaskStatus): Promise<void> => {
    const task = tasks.find((t) => t.id === id)
    if (!task || task.status === status) return
    try {
      await tasksApi.update(id, { status })
      setError(null)
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const count = activeTaskFilters(filters)

  return (
    <Page
      variant={view === 'board' ? 'board' : 'table'}
      title="Tareas"
      meta={
        <span>
          {TASK_PERIODS.find((p) => p.id === period)?.label} ·{' '}
          {tasks.filter((t) => t.status !== 'done').length} abiertas
        </span>
      }
      actions={
        <>
          <SegmentedToggle
            label="Vista"
            value={view}
            onChange={setView}
            options={[
              { id: 'board', label: 'Tablero', icon: Columns3 },
              { id: 'list', label: 'Lista', icon: ListIcon }
            ]}
          />
          {me && (
            <Button
              kind={filters.mine ? 'primary' : 'quiet'}
              onClick={() => setFilters({ ...filters, mine: !filters.mine })}
            >
              Mis tareas
            </Button>
          )}
          <FilterButton count={count} onClick={() => setPanel(true)} />
          <Button kind="primary" onClick={() => setCreating({ title: '', date: today })}>
            <Plus size={15} />
            Nueva tarea
          </Button>
        </>
      }
    >
      <div className={view === 'board' ? 'flex h-full min-h-0 flex-col px-6' : ''}>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Chips label="Periodo" value={period} options={TASK_PERIODS} onChange={setPeriod} />
          {period === 'range' && (
            <span className="flex items-center gap-1.5 text-[13px] text-ob-muted">
              <input
                type="date"
                value={range.from}
                aria-label="Desde"
                onChange={(e) =>
                  e.target.value && setRange((r) => ({ ...r, from: e.target.value }))
                }
                className="h-[26px] rounded-[4px] border border-ob-border bg-ob-bg px-1.5 text-ob-text [color-scheme:dark]"
              />
              a
              <input
                type="date"
                value={range.to}
                aria-label="Hasta"
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
                className="h-[26px] rounded-[4px] border border-ob-border bg-ob-bg px-1.5 text-ob-text [color-scheme:dark]"
              />
            </span>
          )}
        </div>

        {creating && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void create(creating.title, 'todo', creating.date).then(
                (ok) => ok && setCreating(null)
              )
            }}
          >
            <input
              autoFocus
              value={creating.title}
              onChange={(e) => setCreating({ ...creating, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setCreating(null)
                }
              }}
              placeholder="Título y Enter · admite #tags y !alto"
              aria-label="Título de la tarea"
              className={INPUT}
            />
            <input
              type="date"
              value={creating.date}
              aria-label="Día"
              onChange={(e) => e.target.value && setCreating({ ...creating, date: e.target.value })}
              className="h-8 shrink-0 rounded-[4px] border border-ob-border bg-ob-bg px-2 text-[14px] text-ob-text [color-scheme:dark]"
            />
          </form>
        )}

        <ErrorNote message={error ?? loadError} />
        {suggest && (
          <div className="mt-2 flex items-center gap-2 text-[13px] text-ob-muted">
            <Button
              onClick={() =>
                void create(suggest.title, suggest.status, suggest.date).then(
                  (ok) => ok && setCreating(null)
                )
              }
            >
              Crear el {suggest.date}
            </Button>
            es el siguiente día con hueco.
          </div>
        )}

        {view === 'board' ? (
          <div className="no-scrollbar mt-3 flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-4">
            {TASK_STATUSES.map((status) => {
              const column = tasks.filter((t) => t.status === status)
              return (
                <KanbanColumn
                  key={status}
                  title={TASK_STATUS_LABEL[status]}
                  count={column.length}
                  dot={DOT[status]}
                  highlight={over === status}
                  onAdd={() => {
                    setAdding(status)
                    setDraft('')
                  }}
                  addLabel={`Nueva tarea en ${TASK_STATUS_LABEL[status]}`}
                  bodyProps={{
                    onDragOver: (e) => {
                      if (![...e.dataTransfer.types].includes(TASK_DRAG)) return
                      e.preventDefault()
                      setOver(status)
                    },
                    onDragLeave: () => setOver((o) => (o === status ? null : o)),
                    onDrop: (e) => {
                      const id = e.dataTransfer.getData(TASK_DRAG)
                      setOver(null)
                      if (id) void move(id, status)
                    }
                  }}
                >
                  {adding === status && (
                    <KanbanAddField
                      value={draft}
                      onChange={setDraft}
                      onSubmit={() =>
                        void create(draft, status, today).then((ok) => {
                          if (ok) {
                            setDraft('')
                            setAdding(null)
                          }
                        })
                      }
                      onCancel={() => setAdding(null)}
                      placeholder="Título y Enter · para hoy"
                      label={`Nueva tarea en ${TASK_STATUS_LABEL[status]}`}
                    />
                  )}
                  {column.map((t) => (
                    <TaskCard key={t.id} task={t} today={today} onOpen={() => setOpen(t)} />
                  ))}
                  {column.length === 0 && adding !== status && (
                    <p className="px-2 py-3 text-[12px] text-ob-faint">
                      {status === 'done' && openOnly
                        ? 'Este periodo solo muestra lo abierto.'
                        : 'Suelta aquí'}
                    </p>
                  )}
                </KanbanColumn>
              )
            })}
          </div>
        ) : (
          <div className="mt-4">
            {data && tasks.length === 0 ? (
              <Empty
                title="No hay tareas en este periodo."
                hint="Prueba con otro periodo o quita filtros."
              />
            ) : (
              <TaskTable
                tasks={tasks}
                today={today}
                onOpen={setOpen}
                onStatus={(t, status) => void move(t.id, status)}
              />
            )}
          </div>
        )}
      </div>

      <Drawer
        open={panel}
        title="Filtros"
        onClose={() => setPanel(false)}
        footer={
          <button
            type="button"
            disabled={!count}
            onClick={() => setFilters(EMPTY_TASK_FILTERS)}
            className="h-[30px] rounded-[4px] px-3 text-[13px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text disabled:text-ob-faint"
          >
            Limpiar filtros
          </button>
        }
      >
        <TaskFiltersPanel value={filters} onChange={setFilters} />
      </Drawer>

      {open && (
        <TaskDrawer
          key={open.id}
          task={open}
          today={today}
          onClose={closeTask}
          onChanged={() => void reload()}
        />
      )}
    </Page>
  )
}
