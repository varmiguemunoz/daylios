import type { Request, Response } from 'express'
import type { ContactStatus } from '@shared/marketing'
import type { ContactService } from '../services/contact.service'
import { int, text } from './params'

/** Contactos. Filtros de lista: `client`, `prospect`, `q`, `tag`, `status`, `source`, `page`, `pageSize`. */
export class ContactController {
  constructor(private readonly service: ContactService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.list({
        client: text(req.query.client),
        prospect: text(req.query.prospect),
        query: text(req.query.q),
        tag: text(req.query.tag),
        status: text(req.query.status) as ContactStatus | undefined,
        source: text(req.query.source),
        page: int(req.query.page),
        pageSize: int(req.query.pageSize)
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

  subscribe = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.subscribe(String(req.params.id)))
  }

  unsubscribe = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.unsubscribe(String(req.params.id)))
  }

  /** Body: `{ add?: string[], remove?: string[] }`. */
  tag = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.tag(String(req.params.id), req.body ?? {}))
  }

  /** Body: `{ stage?: string }`. */
  promote = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.promote(String(req.params.id), req.body?.stage))
  }
}
