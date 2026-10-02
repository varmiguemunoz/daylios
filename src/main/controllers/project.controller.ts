import type { Request, Response } from 'express'
import type { ProjectService } from '../services/project.service'

/** Proyectos. `:ref` = id o nombre. Crear exige `client` (id o nombre). */
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
}
