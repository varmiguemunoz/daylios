import type { Request, Response } from 'express'
import {
  TASK_PERIODS,
  addDays,
  periodQuery,
  todayKey,
  type TaskBoardQuery,
  type TaskPatch,
  type TaskPeriod
} from '@shared/tasks'
import type { TaskService } from '../services/task.service'
import { dayView, taskView } from '../views/task.view'

export class TaskController {
  constructor(private readonly service: TaskService) {}

  getDay = async (req: Request, res: Response): Promise<void> => {
    const date = text(req.query.date) ?? todayKey()
    res.json(dayView(date, await this.service.getDay(date)))
  }

  history = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.history({
        from: text(req.query.from),
        to: text(req.query.to),
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 7)
      })
    )
  }

  get = async (req: Request, res: Response): Promise<void> => {
    const view = await this.service.get(String(req.params.id))
    res.json({ ...view, task: taskView(view.task), subtasks: view.subtasks.map(taskView) })
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const parent = text(body.parent)
    const task = parent
      ? await this.service.addSubtask(parent, text(body.title) ?? '', text(body.description))
      : await this.service.add(
          text(body.date) ?? todayKey(),
          text(body.title) ?? '',
          text(body.description)
        )
    // Tags / esfuerzo explícitos (además de los que vengan en el título)
    const extra: TaskPatch = {}
    if (Array.isArray(body.tags)) extra.tags = [...task.tags, ...body.tags]
    if (body.effort !== undefined) extra.effort = body.effort
    const saved = Object.keys(extra).length ? await this.service.update(task.id, extra) : task
    res.status(201).json(taskView(saved))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const patch: TaskPatch = {}
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.done === 'boolean') patch.done = body.done
    if (typeof body.status === 'string') patch.status = body.status
    for (const key of ['client', 'project', 'prospect', 'assignee'] as const) {
      if (typeof body[key] === 'string') patch[key] = body[key]
      else if (body[key] === null) patch[key] = ''
    }
    if (typeof body.description === 'string') patch.description = body.description
    if (Array.isArray(body.tags)) patch.tags = body.tags
    if (body.effort !== undefined) patch.effort = body.effort
    res.json(taskView(await this.service.update(String(req.params.id), patch)))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    const { subtasks } = await this.service.remove(String(req.params.id))
    res.json({ ok: true, subtasksRemoved: subtasks.length })
  }

  reorder = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const tasks = await this.service.reorder(text(body.date) ?? todayKey(), body.ids)
    res.json(tasks.map(taskView))
  }

  reorderSubtasks = async (req: Request, res: Response): Promise<void> => {
    const tasks = await this.service.reorderSubtasks(String(req.params.id), (req.body ?? {}).ids)
    res.json(tasks.map(taskView))
  }

  tagSummaries = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.tagSummaries())
  }

  renameTag = async (req: Request, res: Response): Promise<void> => {
    res.json({
      changed: await this.service.renameTag(String(req.params.tag), (req.body ?? {}).name)
    })
  }

  removeTag = async (req: Request, res: Response): Promise<void> => {
    res.json({ changed: await this.service.removeTag(String(req.params.tag)) })
  }

  completeSubtasks = async (req: Request, res: Response): Promise<void> => {
    res.json((await this.service.completeSubtasks(String(req.params.id))).map(taskView))
  }

  move = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.json(taskView(await this.service.moveToDate(String(req.params.id), text(body.date) ?? '')))
  }

  board = async (req: Request, res: Response): Promise<void> => {
    const q = req.query
    const today = todayKey()
    const period = text(q.period) as TaskPeriod | undefined
    const dates =
      period && TASK_PERIODS.some((p) => p.id === period)
        ? periodQuery(period, today, { from: text(q.from) ?? today, to: text(q.to) ?? today })
        : { from: text(q.from), to: text(q.to), onlyOpen: q.open === 'true' }
    const status = text(q.status)
    let tasks = await this.service.board({
      ...dates,
      query: text(q.query),
      tags: text(q.tags)?.split(',').filter(Boolean),
      effort: text(q.effort) as TaskBoardQuery['effort'],
      client: text(q.client),
      project: text(q.project),
      prospect: text(q.prospect),
      assignee: text(q.assignee)
    })
    if (status) tasks = tasks.filter((t) => t.status === status)
    res.json({
      period: period ?? null,
      counts: {
        todo: tasks.filter((t) => t.status === 'todo').length,
        doing: tasks.filter((t) => t.status === 'doing').length,
        done: tasks.filter((t) => t.status === 'done').length
      },
      tasks: tasks.map(taskView)
    })
  }

  carryOver = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const to = text(body.to) ?? todayKey()
    const from = text(body.from) ?? addDays(to, -1)
    const { moved, left } = await this.service.carryOver(from, to)
    res.json({ moved: moved.map(taskView), left: left.map(taskView) })
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
