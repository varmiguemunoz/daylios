import type { Request, Response } from 'express'
import type { ProjectService } from '../services/project.service'

export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(String(req.params.ref)))
  }

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.create(req.body ?? {}))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.update(String(req.params.ref), req.body ?? {}))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    const ref = String(req.params.ref)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, project: await this.service.get(ref) })
      return
    }
    await this.service.remove(ref)
    res.json({ ok: true })
  }
}
