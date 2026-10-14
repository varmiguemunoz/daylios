import { randomUUID } from 'crypto'
import {
  Between,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  type DataSource,
  type EntityManager,
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
  type TaskBoardQuery,
  type TaskRecordKind,
  type TaskStatus,
  type TaskTagSummary,
  type TaskPatch,
  type TaskView,
  type TasksApi,
  TASK_STATUSES
} from '@shared/tasks'
import { TaskModel } from '../models/task.model'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { ProspectModel } from '../models/prospect.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { pageByDay } from './page-by-day'
import { optionalUserId } from './fields'
import { teamUserId } from '../scope'

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
        parentId: null,
        status: 'todo',
        clientId: null,
        projectId: null,
        prospectId: null,
        assigneeId: teamUserId()
      }
      await tasks.insert(task)
      return task
    })
  }

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
        parentId: parent.id,
        status: 'todo',
        clientId: null,
        projectId: null,
        prospectId: null,
        assigneeId: null
      }
      await tasks.insert(task)
      return task
    })
  }

  async reorderSubtasks(parentId: string, ids: string[]): Promise<Task[]> {
    if (!Array.isArray(ids)) throw new AppError('invalid', 'El orden debe ser una lista de ids.')
    return this.write(async (tasks) => {
      const parent = await findOrFail(tasks, parentId)
      const current = await listSubtasks(tasks, parent.id)
      const known = new Set(current.map((t) => t.id))
      if (ids.length !== current.length || !ids.every((id) => known.has(id))) {
        throw new AppError(
          'invalid',
          'El orden no coincide con las subtareas. Recarga y vuelve a intentarlo.'
        )
      }
      for (const [position, id] of ids.entries()) await tasks.update({ id }, { position })
      return listSubtasks(tasks, parent.id)
    })
  }

  async completeSubtasks(parentId: string): Promise<Task[]> {
    return this.write(async (tasks) => {
      const parent = await findOrFail(tasks, parentId)
      const stamp = new Date().toISOString()
      await tasks.update(
        { parentId: parent.id, done: false },
        { done: true, status: 'done', completedAt: stamp }
      )
      return listSubtasks(tasks, parent.id)
    })
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    return this.write(async (tasks, manager) => {
      const task = await findOrFail(tasks, id)
      if (patch.title !== undefined) task.title = checkTitle(patch.title)
      if (patch.description !== undefined) task.description = checkDescription(patch.description)
      if (patch.tags !== undefined) task.tags = checkTags(patch.tags)
      if (patch.effort !== undefined) task.effort = checkEffort(patch.effort)
      // `status` manda; `done` solo (menubar, Claude) pasa a Hecha o vuelve a Pendiente.
      if (patch.status !== undefined) applyStatus(task, checkStatus(patch.status))
      else if (patch.done !== undefined && patch.done !== task.done) {
        applyStatus(task, patch.done ? 'done' : 'todo')
      }
      if (
        patch.client !== undefined ||
        patch.project !== undefined ||
        patch.prospect !== undefined
      ) {
        if (task.parentId) throw new AppError('invalid', 'Las relaciones van en la tarea madre.')
        Object.assign(task, await resolveLinks(manager, task, patch))
      }
      if (patch.assignee !== undefined) task.assigneeId = optionalUserId(patch.assignee)
      return tasks.save(stripExtras(task))
    })
  }

  async setStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.update(id, { status })
  }

  async board(q: TaskBoardQuery): Promise<Task[]> {
    const where: FindOptionsWhere<Task> = {
      parentId: IsNull(),
      ...period(q.from ? checkDay(q.from) : undefined, q.to ? checkDay(q.to) : undefined)
    }
    if (q.onlyOpen) where.status = Not('done')
    if (q.effort) where.effort = checkEffort(q.effort)!
    if (q.client) where.clientId = String(q.client)
    if (q.project) where.projectId = String(q.project)
    if (q.prospect) where.prospectId = String(q.prospect)
    if (q.assignee) where.assigneeId = optionalUserId(q.assignee) ?? IsNull()
    const repo = this.tasks()
    let list = await repo.find({ where, order: { date: 'ASC', position: 'ASC' } })
    // Texto y tags se filtran en memoria (uso personal: pocas filas).
    const text = typeof q.query === 'string' ? q.query.trim().toLowerCase() : ''
    if (text) {
      list = list.filter((t) => `${t.title} ${t.description ?? ''}`.toLowerCase().includes(text))
    }
    const tags = Array.isArray(q.tags) ? q.tags.map((t) => cleanTag(String(t))).filter(Boolean) : []
    if (tags.length) list = list.filter((t) => tags.every((tag) => (t.tags ?? []).includes(tag)))
    return withLinks(this.db.manager, await withProgress(repo, list))
  }

  async forRecord(kind: TaskRecordKind, id: string): Promise<Task[]> {
    const field = { client: 'clientId', project: 'projectId', prospect: 'prospectId' }[kind]
    if (!field || typeof id !== 'string') throw new AppError('invalid', 'Relación desconocida.')
    const repo = this.tasks()
    const list = await repo.find({
      where: { [field]: id, parentId: IsNull() } as FindOptionsWhere<Task>,
      order: { date: 'DESC', position: 'ASC' },
      take: 100
    })
    // Abiertas primero; dentro, las más recientes arriba.
    list.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
    return withLinks(this.db.manager, await withProgress(repo, list))
  }

  async remove(id: string): Promise<RemovedTask> {
    return this.write(async (tasks) => {
      const task = await findOrFail(tasks, id)
      const subtasks = task.parentId ? [] : await listSubtasks(tasks, task.id)
      if (subtasks.length) await tasks.softDelete({ parentId: task.id })
      await tasks.softDelete({ id })
      return { task, subtasks }
    })
  }

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
      await revive(tasks, restored)
      for (const sub of Array.isArray(removed.subtasks) ? removed.subtasks : []) {
        if (await tasks.findOneBy({ id: sub.id })) continue
        await revive(
          tasks,
          clean({ ...sub, date: day, title: checkTitle(sub.title), parentId: task.id })
        )
      }
      return restored
    })
  }

  async reorder(date: DayKey, ids: string[]): Promise<Task[]> {
    const day = checkDay(date)
    if (!Array.isArray(ids)) throw new AppError('invalid', 'El orden debe ser una lista de ids.')
    return this.write(async (tasks) => {
      const current = await listDay(tasks, day)
      const known = new Set(current.map((t) => t.id))
      if (ids.length !== current.length || !ids.every((id) => known.has(id))) {
        throw new AppError(
          'invalid',
          'El orden no coincide con las tareas del día. Recarga y vuelve a intentarlo.'
        )
      }
      for (const [position, id] of ids.entries()) await tasks.update({ id }, { position })
      return listDay(tasks, day)
    })
  }

  async tags(): Promise<string[]> {
    const rows = await this.tasks().find({ select: { tags: true } })
    const count = new Map<string, number>()
    for (const row of rows)
      for (const tag of row.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).map(([tag]) => tag)
  }

  async tagSummaries(): Promise<TaskTagSummary[]> {
    const rows = await this.tasks().find({ select: { tags: true } })
    const count = new Map<string, number>()
    for (const row of rows)
      for (const tag of row.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1)
    return [...count]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([tag, tasks]) => ({ tag, tasks }))
  }

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

  async carryOver(from: DayKey, to: DayKey): Promise<CarryOverResult> {
    const source = checkDay(from)
    const target = checkDay(to)
    if (source === target) throw new AppError('invalid', 'El día de origen y destino es el mismo.')

    return this.write(async (tasks) => {
      const pending = (await listDay(tasks, source)).filter((t) => !t.done)
      const room = Math.max(
        0,
        DAILY_LIMIT - (await tasks.countBy({ date: target, parentId: IsNull() }))
      )
      const moved: Task[] = []
      for (const task of pending.slice(0, room)) moved.push(await move(tasks, task, target))
      return { moved, left: pending.slice(room) }
    })
  }

  // ---- internos ----

  private tasks(): Tasks {
    return this.db.getRepository(TaskModel)
  }

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

  private write<T>(work: (tasks: Tasks, manager: EntityManager) => Promise<T>): Promise<T> {
    return transactionGuard(this.db, (manager) => work(manager.getRepository(TaskModel), manager))
  }
}

// ---- ayudantes (reciben el repositorio de la transacción en curso) ----

function dayWhere(date: DayKey): FindOptionsWhere<Task> | FindOptionsWhere<Task>[] {
  const me = teamUserId()
  if (!me) return { date, parentId: IsNull() }
  return [
    { date, parentId: IsNull(), assigneeId: me },
    { date, parentId: IsNull(), assigneeId: IsNull() }
  ]
}

function listDay(tasks: Tasks, date: DayKey): Promise<Task[]> {
  return tasks.find({ where: dayWhere(date), order: { position: 'ASC' } })
}

function listSubtasks(tasks: Tasks, parentId: string): Promise<Task[]> {
  return tasks.find({ where: { parentId }, order: { position: 'ASC', createdAt: 'ASC' } })
}

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
  const byParent = new Map(
    rows.map((r) => [r.parentId, { total: Number(r.total), done: Number(r.done ?? 0) }])
  )
  return list.map((t) => {
    const progress = byParent.get(t.id)
    return progress ? { ...t, subtasks: progress } : t
  })
}

async function revive(tasks: Tasks, task: Task): Promise<void> {
  const gone = await tasks.findOne({ where: { id: task.id }, withDeleted: true })
  if (!gone) return void (await tasks.insert(task))
  await tasks.restore({ id: task.id })
  await tasks.save(task)
}

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
    parentId: task.parentId ?? null,
    // Lo borrado antes de existir el estado solo trae `done`.
    status: TASK_STATUSES.includes(task.status) ? task.status : task.done ? 'done' : 'todo',
    clientId: task.clientId ?? null,
    projectId: task.projectId ?? null,
    prospectId: task.prospectId ?? null,
    assigneeId: task.assigneeId ?? null
  }
}

function applyStatus(task: Task, status: TaskStatus): void {
  const done = status === 'done'
  if (done && !task.done) task.completedAt = new Date().toISOString()
  if (!done) task.completedAt = null
  task.status = status
  task.done = done
}

function checkStatus(value: unknown): TaskStatus {
  if (!TASK_STATUSES.includes(value as TaskStatus)) {
    throw new AppError('invalid', 'El estado debe ser todo, doing o done.')
  }
  return value as TaskStatus
}

function stripExtras(task: Task): Task {
  const copy = { ...task }
  delete copy.subtasks
  delete copy.links
  return copy
}

async function resolveLinks(
  manager: EntityManager,
  task: Task,
  patch: TaskPatch
): Promise<Pick<Task, 'clientId' | 'projectId' | 'prospectId'>> {
  let clientId = task.clientId ?? null
  let projectId = task.projectId ?? null
  let prospectId = task.prospectId ?? null
  if (patch.client !== undefined) {
    clientId = patch.client
      ? (await exists(manager, ClientModel, patch.client, 'ese cliente')).id
      : null
    if (projectId) {
      const project = await manager.getRepository(ProjectModel).findOneBy({ id: projectId })
      if (!project || project.clientId !== clientId) projectId = null
    }
  }
  if (patch.project !== undefined) {
    if (patch.project) {
      const project = await manager
        .getRepository(ProjectModel)
        .findOneBy({ id: String(patch.project) })
      if (!project) throw new AppError('not_found', 'No existe ese proyecto.')
      projectId = project.id
      clientId = project.clientId
    } else projectId = null
  }
  if (patch.prospect !== undefined) {
    prospectId = patch.prospect
      ? (await exists(manager, ProspectModel, patch.prospect, 'ese prospecto')).id
      : null
  }
  return { clientId, projectId, prospectId }
}

async function exists(
  manager: EntityManager,
  model: typeof ClientModel | typeof ProspectModel,
  id: unknown,
  what: string
): Promise<{ id: string }> {
  const row = (await manager.getRepository(model).findOneBy({ id: String(id) })) as {
    id: string
  } | null
  if (!row) throw new AppError('not_found', `No existe ${what}.`)
  return row
}

async function withLinks(manager: EntityManager, list: Task[]): Promise<Task[]> {
  const ids = (key: 'clientId' | 'projectId' | 'prospectId'): string[] => [
    ...new Set(list.map((t) => t[key]).filter((v): v is string => !!v))
  ]
  const [clients, projects, prospects] = await Promise.all([
    ids('clientId').length
      ? manager.getRepository(ClientModel).findBy({ id: In(ids('clientId')) })
      : [],
    ids('projectId').length
      ? manager.getRepository(ProjectModel).findBy({ id: In(ids('projectId')) })
      : [],
    ids('prospectId').length
      ? manager.getRepository(ProspectModel).findBy({ id: In(ids('prospectId')) })
      : []
  ])
  const client = new Map<string, string>(clients.map((c): [string, string] => [c.id, c.name]))
  const project = new Map<string, string>(projects.map((p): [string, string] => [p.id, p.name]))
  const prospect = new Map<string, string>(
    prospects.map((p): [string, string] => [p.id, p.company])
  )
  return list.map((t) => {
    const links: Task['links'] = {}
    if (t.clientId && client.has(t.clientId))
      links.client = { id: t.clientId, name: client.get(t.clientId)! }
    if (t.projectId && project.has(t.projectId))
      links.project = { id: t.projectId, name: project.get(t.projectId)! }
    if (t.prospectId && prospect.has(t.prospectId)) {
      links.prospect = { id: t.prospectId, company: prospect.get(t.prospectId)! }
    }
    return Object.keys(links).length ? { ...t, links } : t
  })
}

export async function unlinkTasks(
  manager: EntityManager,
  kind: TaskRecordKind,
  id: string
): Promise<void> {
  const repo = manager.getRepository(TaskModel)
  if (kind === 'client') await repo.update({ clientId: id }, { clientId: null, projectId: null })
  else if (kind === 'project') await repo.update({ projectId: id }, { projectId: null })
  else await repo.update({ prospectId: id }, { prospectId: null })
}

async function findOrFail(tasks: Tasks, id: unknown): Promise<Task> {
  const task = typeof id === 'string' ? await tasks.findOneBy({ id }) : null
  if (!task) throw new AppError('not_found', 'No existe esa tarea.')
  return task
}

async function assertRoom(tasks: Tasks, date: DayKey): Promise<void> {
  const me = teamUserId()
  const where: FindOptionsWhere<Task> = me
    ? { date, parentId: IsNull(), assigneeId: me }
    : { date, parentId: IsNull() }
  if ((await tasks.countBy(where)) >= DAILY_LIMIT) {
    throw new AppError('day_full', `El ${date} ya tiene ${DAILY_LIMIT} tareas.`)
  }
}

async function nextPosition(tasks: Tasks, date: DayKey): Promise<number> {
  const max = await tasks.maximum('position', { date, parentId: IsNull() })
  return (max ?? -1) + 1
}

async function move(tasks: Tasks, task: Task, date: DayKey): Promise<Task> {
  if (task.parentId)
    throw new AppError('invalid', 'Una subtarea va con su tarea madre: mueve la madre.')
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
  if (!EFFORTS.includes(value as Effort))
    throw new AppError('invalid', 'El esfuerzo debe ser alto, medio o bajo.')
  return value as Effort
}

function checkDescription(value: unknown): string | null {
  if (typeof value !== 'string') throw new AppError('invalid', 'La descripción debe ser texto.')
  if (value.length > MAX_DESCRIPTION) {
    throw new AppError('invalid', `La descripción no puede pasar de ${MAX_DESCRIPTION} caracteres.`)
  }
  return value.trim() ? value : null
}
