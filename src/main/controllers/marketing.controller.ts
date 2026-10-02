import type { Request, Response } from 'express'
import type { Marketing } from '../marketing'

/** Email marketing para Claude (vía MCP): tags, fuentes, reglas, secuencias y newsletter. */
export class MarketingController {
  constructor(private readonly m: Marketing) {}

  status = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sync.status())
  }

  sources = async (_req: Request, res: Response): Promise<void> => {
    // Sin secretos: Claude no los necesita para nada.
    res.json((await this.m.sources.list()).map((s) => ({ ...s, secret: undefined })))
  }

  rules = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.rules.list())
  }

  createRule = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.m.rules.create(req.body ?? {}))
  }

  updateRule = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.rules.update(String(req.params.id), req.body ?? {}))
  }

  removeRule = async (req: Request, res: Response): Promise<void> => {
    await this.m.rules.remove(String(req.params.id))
    res.json({ ok: true })
  }

  sequences = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sequences.list())
  }

  sequence = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sequences.get(String(req.params.id)))
  }

  /** Body: `{ id?, name, event, emails: [{ wait?, subject, html }], enabled? }`. */
  saveSequence = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sequences.save(req.body ?? {}))
  }

  sequenceStatus = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sequences.setStatus(String(req.params.id), req.body?.enabled))
  }

  newsletters = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.newsletters.list(Number(req.query.limit) || 30))
  }

  newsletter = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.newsletters.get(String(req.params.id)))
  }

  newsletterContext = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.newsletters.context())
  }

  /** Body: `{ tag, subject, html, scheduledAt? }`. */
  sendNewsletter = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.m.newsletters.send(req.body ?? {}))
  }

  tags = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.tags.list())
  }

  renameTag = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.tags.rename(String(req.params.slug), req.body?.name))
  }
}
