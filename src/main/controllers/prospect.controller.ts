import type { Request, Response } from 'express'
import type { ProspectService } from '../services/prospect.service'

/** Pipeline y prospectos. `:ref` = id o nombre de la empresa. */
export class ProspectController {
  constructor(private readonly service: ProspectService) {}

  pipeline = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.pipeline())
  }

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(String(req.params.ref)))
  }

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.create(req.body ?? {}))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.update(String(req.params.ref), req.body ?? {}))
  }

  /** `{ stage }` = id o nombre de la etapa. Ganar crea el cliente. */
  move = async (req: Request, res: Response): Promise<void> => {
    const index = typeof req.body?.index === 'number' ? req.body.index : undefined
    res.json(await this.service.move(String(req.params.ref), req.body?.stage, index))
  }
}
