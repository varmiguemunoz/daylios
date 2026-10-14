import type { Request, Response } from 'express'
import type { ClientStatus } from '@shared/consultora'
import type { ClientService } from '../services/client.service'
import { text } from './params'

export class ClientController {
  constructor(private readonly service: ClientService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.list(text(req.query.status) as ClientStatus | undefined))
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

  impact = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.impact(String(req.params.ref)))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    const ref = String(req.params.ref)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, impact: await this.service.impact(ref) })
      return
    }
    await this.service.remove(ref, { trashFolder: req.query.trashFolder === '1' })
    res.json({ ok: true })
  }
}
