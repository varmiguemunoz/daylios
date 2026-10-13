import type { Request, Response } from 'express'
import type { ContactStatus } from '@shared/marketing'
import type { ContactService } from '../services/contact.service'
import { flag, int, text } from './params'

/**
 * Contactos. Filtros de lista: `client`, `prospect`, `q`, `tag`, `tags` (coma), `inPipeline` (1/0),
 * `status`, `source`, `page`, `pageSize`.
 */
export class ContactController {
  constructor(private readonly service: ContactService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.list({
        client: text(req.query.client),
        prospect: text(req.query.prospect),
        query: text(req.query.q),
        tag: text(req.query.tag),
        tags: list(req.query.tags),
        inPipeline: req.query.inPipeline === undefined ? undefined : flag(req.query.inPipeline),
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

  /** Sin `?confirm=1` devuelve el contacto y no borra. */
  remove = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, contact: await this.service.get(id) })
      return
    }
    await this.service.remove(id)
    res.json({ ok: true })
  }

  /** Body: `{ pipeline?, stage?, company?, valueUsd? }`. */
  convert = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.convert(String(req.params.id), req.body ?? {}))
  }

  detachProspect = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.detachProspect(String(req.params.id)))
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

/** `a,b` o `?tags=a&tags=b` → lista. */
const list = (v: unknown): string[] | undefined => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  const out = raw.map((x) => String(x).trim()).filter(Boolean)
  return out.length ? out : undefined
}
