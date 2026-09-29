import type { Request, Response } from 'express'
import { addDays, todayKey, type TaskPatch } from '@shared/tasks'
import type { TaskService } from '../services/task.service'
import { dayView, taskView } from '../views/task.view'

/**
 * Controlador: lee la petición, llama al servicio y responde con la vista.
 * Sin reglas de negocio aquí. Los errores los atrapa `errorHandler` (Express 5 captura async).
 */
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

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const task = await this.service.add(text(body.date) ?? todayKey(), text(body.title) ?? '')
    res.status(201).json(taskView(task))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const patch: TaskPatch = {}
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.done === 'boolean') patch.done = body.done
    res.json(taskView(await this.service.update(String(req.params.id), patch)))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(String(req.params.id))
    res.json({ ok: true })
  }

  move = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.json(taskView(await this.service.moveToDate(String(req.params.id), text(body.date) ?? '')))
  }

  /** Por defecto: de ayer a hoy. */
  carryOver = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const to = text(body.to) ?? todayKey()
    const from = text(body.from) ?? addDays(to, -1)
    const { moved, left } = await this.service.carryOver(from, to)
    res.json({ moved: moved.map(taskView), left: left.map(taskView) })
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
