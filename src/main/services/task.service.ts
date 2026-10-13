import { randomUUID } from 'crypto'
import {
  Between,
  IsNull,
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
  type RemovedTask,
  type Task,
  type TaskTagSummary,
  type TaskPatch,
  type TaskView,
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
    const tasks = this.tasks()
    return withProgress(tasks, await listDay(tasks, checkDay(date)))
  }

  async get(id: string): Promise<TaskView> {
    const tasks = this.tasks()
    const task = await findOrFail(tasks, id)
    const parent = task.parentId ? await tasks.findOneBy({ id: task.parentId }) : null
    return {
      task,
      parent: parent && { id: parent.id, title: parent.title },
      subtasks: task.parentId ? [] : await listSubtasks(tasks, task.id)
    }
  }

  async history(q: HistoryQuery): Promise<HistoryPage> {
    const from = q.from ? checkDay(q.from) : undefined
    const to = q.to ? checkDay(q.to) : undefined

    // Uso personal (máx. 8 tareas/día): traer el periodo y agrupar en memoria es simple y rápido.
    const repo = this.tasks()
    const tasks = await withProgress(
      repo,
      await repo.find({
        where: { ...period(from, to), parentId: IsNull() },
        order: { date: 'DESC', position: 'ASC' }
      })
    )
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
        effort: parsed.effort,
        parentId: null
      }
      await tasks.insert(task)
      return task
    })
  }

  /** Subtarea al final de su madre. Vive en el día de la madre y no cuenta para el techo. */
  async addSubtask(parentId: string, title: string, description?: string): Promise<Task> {
    const parsed = parseCapture(typeof title === 'string' ? title : '')
    const clean = checkTitle(parsed.title)
    const details = checkDescription(description ?? '')
    return this.write(async (tasks) => {
      const parent = await findOrFail(tasks, parentId)
      if (parent.parentId) throw new AppError('invalid', 'Una subtarea no puede tener subtareas.')
      const max = await tasks.maximum('position', { parentId: parent.id })
      const task: Task = {
        id: randomUUID(),
        title: clean,
        date: parent.date,
        done: false,
        position: (max ?? -1) + 1,
        createdAt: new Date().toISOString(),
        completedAt: null,
        carriedFrom: null,
        description: details,
        tags: parsed.tags,
        effort: parsed.effort,
        parentId: parent.id
      }
      await tasks.insert(task)
      return task
    })
  }

  /** Nuevo orden de las subtareas de una madre (lista completa de ids). */
  async reorderSubtasks(parentId: string, ids: string[]): Promise<Task[]> {
    if (!Array.isArray(ids)) throw new AppError('invalid', 'El orden debe ser una lista de ids.')
    return this.write(async (tasks) => {
      const parent = await findOrFail(tasks, parentId)
      const current = await listSubtasks(tasks, parent.id)
      const known = new Set(current.map((t) => t.id))
      if (ids.length !== current.length || !ids.every((id) => known.has(id))) {
        throw new AppError('invalid', 'El orden no coincide con las subtareas. Recarga y vuelve a intentarlo.')
      }
      for (const [position, id] of ids.entries()) await tasks.update({ id }, { position })
      return listSubtasks(tasks, parent.id)
    })
  }

  /** Marca hechas todas las subtareas pendientes de una madre. */
  async completeSubtasks(parentId: string): Promise<Task[]> {
    return this.write(async (tasks) => {
      const parent = await findOrFail(tasks, parentId)
      const stamp = new Date().toISOString()
      await tasks.update({ parentId: parent.id, done: false }, { done: true, completedAt: stamp })
      return listSubtasks(tasks, parent.id)
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

  /** Borra la tarea y, si es madre, sus subtareas. Devuelve lo borrado (deshacer). */
  async remove(id: string): Promise<RemovedTask> {
    return this.write(async (tasks) => {
      const task = await findOrFail(tasks, id)
      const subtasks = task.parentId ? [] : await listSubtasks(tasks, task.id)
      if (subtasks.length) await tasks.delete({ parentId: task.id })
      await tasks.delete({ id })
      return { task, subtasks }
    })
  }

  /** Reinserta lo borrado (deshacer): la madre con sus subtareas tal como estaban. */
  async restore(removed: RemovedTask): Promise<Task> {
    const task = removed?.task
    if (!task) throw new AppError('invalid', 'Nada que restaurar.')
    const day = checkDay(task.date)
    const title = checkTitle(task.title)
    return this.write(async (tasks) => {
      const existing = await tasks.findOneBy({ id: task.id })
      if (existing) return existing
      const parentId = task.parentId ?? null
      if (parentId) await findOrFail(tasks, parentId)
      else await assertRoom(tasks, day)
      const restored = clean({ ...task, date: day, title, parentId })
      await tasks.insert(restored)
      for (const sub of Array.isArray(removed.subtasks) ? removed.subtasks : []) {
        if (await tasks.findOneBy({ id: sub.id })) continue
        await tasks.insert(clean({ ...sub, date: day, title: checkTitle(sub.title), parentId: task.id }))
      }
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

  async tagSummaries(): Promise<TaskTagSummary[]> {
    const rows = await this.tasks().find({ select: { tags: true } })
    const count = new Map<string, number>()
    for (const row of rows) for (const tag of row.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1)
    return [...count]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([tag, tasks]) => ({ tag, tasks }))
  }

  /** Renombra en todas las tareas; si `to` ya estaba en una tarea, queda una sola vez. */
  async renameTag(from: string, to: string): Promise<number> {
    const old = cleanTag(String(from ?? ''))
    const next = cleanTag(String(to ?? ''))
    if (!old || !next) throw new AppError('invalid', 'El tag no puede estar vacío.')
    if (old === next) return 0
    return this.rewriteTags(old, (tags) => [...new Set(tags.map((t) => (t === old ? next : t)))])
  }

  async removeTag(tag: string): Promise<number> {
    const old = cleanTag(String(tag ?? ''))
    if (!old) throw new AppError('invalid', 'El tag no puede estar vacío.')
    return this.rewriteTags(old, (tags) => tags.filter((t) => t !== old))
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
      const room = Math.max(0, DAILY_LIMIT - (await tasks.countBy({ date: target, parentId: IsNull() })))
      const moved: Task[] = []
      for (const task of pending.slice(0, room)) moved.push(await move(tasks, task, target))
      return { moved, left: pending.slice(room) }
    })
  }

  // ---- internos ----

  private tasks(): Tasks {
    return this.db.getRepository(TaskModel)
  }

  /** Reescribe los tags de las tareas que tienen `tag` (uso personal: se filtra en memoria). */
  private rewriteTags(tag: string, change: (tags: string[]) => string[]): Promise<number> {
    return this.write(async (tasks) => {
      const all = await tasks.find({ select: { id: true, tags: true } })
      let changed = 0
      for (const row of all) {
        if (!(row.tags ?? []).includes(tag)) continue
        await tasks.update({ id: row.id }, { tags: change(row.tags).slice(0, MAX_TAGS) })
        changed++
      }
      return changed
    })
  }

  /** Ejecuta la escritura dentro del guard: si algo falla, se revierte todo. */
  private write<T>(work: (tasks: Tasks) => Promise<T>): Promise<T> {
    return transactionGuard(this.db, (manager) => work(manager.getRepository(TaskModel)))
  }
}

// ---- ayudantes (reciben el repositorio de la transacción en curso) ----

/** Tareas madre del día (las subtareas no son filas del día). */
function listDay(tasks: Tasks, date: DayKey): Promise<Task[]> {
  return tasks.find({ where: { date, parentId: IsNull() }, order: { position: 'ASC' } })
}

function listSubtasks(tasks: Tasks, parentId: string): Promise<Task[]> {
  return tasks.find({ where: { parentId }, order: { position: 'ASC', createdAt: 'ASC' } })
}

/** Añade a cada madre el avance de sus subtareas (una consulta agrupada). */
async function withProgress(tasks: Tasks, list: Task[]): Promise<Task[]> {
  if (!list.length) return list
  const rows: { parentId: string; total: string; done: string }[] = await tasks
    .createQueryBuilder('t')
    .select('t.parentId', 'parentId')
    .addSelect('COUNT(*)', 'total')
    .addSelect('SUM(CASE WHEN t.done = 1 THEN 1 ELSE 0 END)', 'done')
    .where('t.parentId IN (:...ids)', { ids: list.map((t) => t.id) })
    .groupBy('t.parentId')
    .getRawMany()
  const byParent = new Map(rows.map((r) => [r.parentId, { total: Number(r.total), done: Number(r.done ?? 0) }]))
  return list.map((t) => {
    const progress = byParent.get(t.id)
    return progress ? { ...t, subtasks: progress } : t
  })
}

/** Solo columnas de la tabla (lo que viene de la UI puede traer `subtasks`). */
function clean(task: Task): Task {
  return {
    id: task.id,
    title: task.title,
    date: task.date,
    done: Boolean(task.done),
    position: Number(task.position) || 0,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
    carriedFrom: task.carriedFrom ?? null,
    description: task.description ?? null,
    tags: checkTags(task.tags ?? []),
    effort: checkEffort(task.effort ?? null),
    parentId: task.parentId ?? null
  }
}

async function findOrFail(tasks: Tasks, id: unknown): Promise<Task> {
  const task = typeof id === 'string' ? await tasks.findOneBy({ id }) : null
  if (!task) throw new AppError('not_found', 'No existe esa tarea.')
  return task
}

/** El techo cuenta solo tareas madre. */
async function assertRoom(tasks: Tasks, date: DayKey): Promise<void> {
  if ((await tasks.countBy({ date, parentId: IsNull() })) >= DAILY_LIMIT) {
    throw new AppError('day_full', `El ${date} ya tiene ${DAILY_LIMIT} tareas.`)
  }
}

async function nextPosition(tasks: Tasks, date: DayKey): Promise<number> {
  const max = await tasks.maximum('position', { date, parentId: IsNull() })
  return (max ?? -1) + 1
}

/** Pone la tarea al final de otro día, recuerda su origen y se lleva sus subtareas. */
async function move(tasks: Tasks, task: Task, date: DayKey): Promise<Task> {
  if (task.parentId) throw new AppError('invalid', 'Una subtarea va con su tarea madre: mueve la madre.')
  if (task.date === date) return task
  await assertRoom(tasks, date)
  const saved = await tasks.save({
    ...task,
    date,
    position: await nextPosition(tasks, date),
    carriedFrom: task.carriedFrom ?? task.date
  })
  await tasks.update({ parentId: task.id }, { date })
  return saved
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
