import type { Request, Response } from 'express'
import type { ContactService } from '../services/contact.service'
import { text } from './params'

/** Contactos. Filtros de lista: `client`, `prospect`, `q`. */
export class ContactController {
  constructor(private readonly service: ContactService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.list({
        client: text(req.query.client),
        prospect: text(req.query.prospect),
        query: text(req.query.q)
      })
    )
  }

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(String(req.params.id)))
  }

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.create(req.body ?? {}))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.update(String(req.params.id), req.body ?? {}))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(String(req.params.id))
    res.json({ ok: true })
  }
}
