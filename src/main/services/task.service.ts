import { randomUUID } from 'crypto'
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  type DataSource,
  type FindOptionsWhere,
  type Repository
} from 'typeorm'
import {
  DAILY_LIMIT,
  EFFORTS,
  MAX_TAGS,
  cleanTag,
  isDayKey,
  parseCapture,
  type Effort,
  type CarryOverResult,
  type DayKey,
  type HistoryPage,
  type HistoryQuery,
  type Task,
  type TaskPatch,
  type TasksApi
} from '@shared/tasks'
import { TaskModel } from '../models/task.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { pageByDay } from './page-by-day'

const MAX_TITLE = 200
const MAX_DESCRIPTION = 20_000

type Tasks = Repository<Task>

export class TaskService implements TasksApi {
  constructor(private readonly db: DataSource) {}

  // ---- lecturas ----

  async getDay(date: DayKey): Promise<Task[]> {
    return listDay(this.tasks(), checkDay(date))
  }

  async history(q: HistoryQuery): Promise<HistoryPage> {
    const from = q.from ? checkDay(q.from) : undefined
    const to = q.to ? checkDay(q.to) : undefined

    // Uso personal (máx. 8 tareas/día): traer el periodo y agrupar en memoria es simple y rápido.
    const tasks = await this.tasks().find({
      where: period(from, to),
      order: { date: 'DESC', position: 'ASC' }
    })
    const { days, ...pages } = pageByDay(tasks, q.page, q.pageSize)

    return {
      ...pages,
      days: days.map(({ date, items }) => ({ date, tasks: items })),
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t) => t.done).length
    }
  }

  // ---- escrituras ----

  /** El título puede llevar `#tags` y `!alto|!medio|!bajo`: se separan aquí (UI y Claude por igual). */
  async add(date: DayKey, title: string, description?: string): Promise<Task> {
    const day = checkDay(date)
    const parsed = parseCapture(typeof title === 'string' ? title : '')
    const clean = checkTitle(parsed.title)
    const details = checkDescription(description ?? '')
    return this.write(async (tasks) => {
      await assertRoom(tasks, day)
      const task: Task = {
        id: randomUUID(),
        title: clean,
        date: day,
        done: false,
        position: await nextPosition(tasks, day),
        createdAt: new Date().toISOString(),
        completedAt: null,
        carriedFrom: null,
        description: details,
        tags: parsed.tags,
        effort: parsed.effort
      }
      await tasks.insert(task)
      return task
    })
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    return this.write(async (tasks) => {
      const task = await findOrFail(tasks, id)
      if (patch.title !== undefined) task.title = checkTitle(patch.title)
      if (patch.description !== undefined) task.description = checkDescription(patch.description)
      if (patch.tags !== undefined) task.tags = checkTags(patch.tags)
      if (patch.effort !== undefined) task.effort = checkEffort(patch.effort)
      if (patch.done !== undefined && patch.done !== task.done) {
        task.done = patch.done
        task.completedAt = patch.done ? new Date().toISOString() : null
      }
      return tasks.save(task)
    })
  }

  async remove(id: string): Promise<void> {
    await this.write(async (tasks) => {
      await findOrFail(tasks, id)
      await tasks.delete({ id })
    })
  }

  /** Reinserta una tarea borrada (deshacer). */
  async restore(task: Task): Promise<Task> {
    const day = checkDay(task.date)
    const title = checkTitle(task.title)
    return this.write(async (tasks) => {
      const existing = await tasks.findOneBy({ id: task.id })
      if (existing) return existing
      await assertRoom(tasks, day)
      const restored: Task = {
        ...task,
        date: day,
        title,
        description: task.description ?? null,
        tags: checkTags(task.tags ?? []),
        effort: checkEffort(task.effort ?? null)
      }
      await tasks.insert(restored)
      return restored
    })
  }

  /** Nuevo orden de un día: `ids` en el orden deseado (todas las tareas del día). */
  async reorder(date: DayKey, ids: string[]): Promise<Task[]> {
    const day = checkDay(date)
    if (!Array.isArray(ids)) throw new AppError('invalid', 'El orden debe ser una lista de ids.')
    return this.write(async (tasks) => {
      const current = await listDay(tasks, day)
      const known = new Set(current.map((t) => t.id))
      if (ids.length !== current.length || !ids.every((id) => known.has(id))) {
        throw new AppError('invalid', 'El orden no coincide con las tareas del día. Recarga y vuelve a intentarlo.')
      }
      for (const [position, id] of ids.entries()) await tasks.update({ id }, { position })
      return listDay(tasks, day)
    })
  }

  /** Tags usados, del más frecuente al menos (para sugerir al escribir). */
  async tags(): Promise<string[]> {
    const rows = await this.tasks().find({ select: { tags: true } })
    const count = new Map<string, number>()
    for (const row of rows) for (const tag of row.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).map(([tag]) => tag)
  }

  async moveToDate(id: string, date: DayKey): Promise<Task> {
    const day = checkDay(date)
    return this.write(async (tasks) => move(tasks, await findOrFail(tasks, id), day))
  }

  /** Mueve las pendientes de `from` a `to` mientras haya hueco. */
  async carryOver(from: DayKey, to: DayKey): Promise<CarryOverResult> {
    const source = checkDay(from)
    const target = checkDay(to)
    if (source === target) throw new AppError('invalid', 'El día de origen y destino es el mismo.')

    return this.write(async (tasks) => {
      const pending = (await listDay(tasks, source)).filter((t) => !t.done)
      const room = Math.max(0, DAILY_LIMIT - (await tasks.countBy({ date: target })))
      const moved: Task[] = []
      for (const task of pending.slice(0, room)) moved.push(await move(tasks, task, target))
      return { moved, left: pending.slice(room) }
    })
  }

  // ---- internos ----

  private tasks(): Tasks {
    return this.db.getRepository(TaskModel)
  }

  /** Ejecuta la escritura dentro del guard: si algo falla, se revierte todo. */
  private write<T>(work: (tasks: Tasks) => Promise<T>): Promise<T> {
    return transactionGuard(this.db, (manager) => work(manager.getRepository(TaskModel)))
  }
}

// ---- ayudantes (reciben el repositorio de la transacción en curso) ----

function listDay(tasks: Tasks, date: DayKey): Promise<Task[]> {
  return tasks.find({ where: { date }, order: { position: 'ASC' } })
}

async function findOrFail(tasks: Tasks, id: unknown): Promise<Task> {
  const task = typeof id === 'string' ? await tasks.findOneBy({ id }) : null
  if (!task) throw new AppError('not_found', 'No existe esa tarea.')
  return task
}

async function assertRoom(tasks: Tasks, date: DayKey): Promise<void> {
  if ((await tasks.countBy({ date })) >= DAILY_LIMIT) {
    throw new AppError('day_full', `El ${date} ya tiene ${DAILY_LIMIT} tareas.`)
  }
}

async function nextPosition(tasks: Tasks, date: DayKey): Promise<number> {
  const max = await tasks.maximum('position', { date })
  return (max ?? -1) + 1
}

/** Pone la tarea al final de otro día y recuerda su día de origen. */
async function move(tasks: Tasks, task: Task, date: DayKey): Promise<Task> {
  if (task.date === date) return task
  await assertRoom(tasks, date)
  return tasks.save({
    ...task,
    date,
    position: await nextPosition(tasks, date),
    carriedFrom: task.carriedFrom ?? task.date
  })
}

/** Filtro por periodo: from/to son opcionales e inclusivos. */
function period(from?: DayKey, to?: DayKey): FindOptionsWhere<Task> {
  if (from && to) return { date: Between(from, to) }
  if (from) return { date: MoreThanOrEqual(from) }
  if (to) return { date: LessThanOrEqual(to) }
  return {}
}

function checkDay(date: unknown): DayKey {
  if (!isDayKey(date)) throw new AppError('invalid', 'La fecha debe tener formato YYYY-MM-DD.')
  return date
}

function checkTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : ''
  if (!title) throw new AppError('invalid', 'El título no puede estar vacío.')
  if (title.length > MAX_TITLE) {
    throw new AppError('invalid', `El título no puede pasar de ${MAX_TITLE} caracteres.`)
  }
  return title
}

function checkTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AppError('invalid', 'Los tags deben ser una lista.')
  const tags = [...new Set(value.map((t) => cleanTag(String(t))).filter(Boolean))]
  if (tags.length > MAX_TAGS) throw new AppError('invalid', `Máximo ${MAX_TAGS} tags por tarea.`)
  return tags
}

function checkEffort(value: unknown): Effort | null {
  if (value === null || value === undefined || value === '') return null
  if (!EFFORTS.includes(value as Effort)) throw new AppError('invalid', 'El esfuerzo debe ser alto, medio o bajo.')
  return value as Effort
}

/** Texto vacío = sin descripción (null). */
function checkDescription(value: unknown): string | null {
  if (typeof value !== 'string') throw new AppError('invalid', 'La descripción debe ser texto.')
  if (value.length > MAX_DESCRIPTION) {
    throw new AppError('invalid', `La descripción no puede pasar de ${MAX_DESCRIPTION} caracteres.`)
  }
  return value.trim() ? value : null
}
