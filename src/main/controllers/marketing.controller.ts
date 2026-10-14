import type { Request, Response } from 'express'
import type { Marketing } from '../marketing'

export class MarketingController {
  constructor(private readonly m: Marketing) {}

  status = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.sync.status())
  }

  sources = async (_req: Request, res: Response): Promise<void> => {
    // Sin secretos: Claude no los necesita para nada.
    res.json((await this.m.sources.list()).map((s) => ({ ...s, secret: undefined })))
  }

  createSource = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ ...(await this.m.sources.create(req.body ?? {})), secret: undefined })
  }

  updateSource = async (req: Request, res: Response): Promise<void> => {
    res.json({
      ...(await this.m.sources.update(String(req.params.slug), req.body ?? {})),
      secret: undefined
    })
  }

  rotateSource = async (req: Request, res: Response): Promise<void> => {
    res.json({ ...(await this.m.sources.rotateSecret(String(req.params.slug))), secret: undefined })
  }

  removeSource = async (req: Request, res: Response): Promise<void> => {
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, slug: String(req.params.slug) })
      return
    }
    await this.m.sources.remove(String(req.params.slug))
    res.json({ ok: true })
  }

  syncNow = async (_req: Request, res: Response): Promise<void> => {
    await this.m.sync.tick()
    res.json(await this.m.sync.status())
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

  sendNewsletter = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.m.newsletters.send(req.body ?? {}))
  }

  tags = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.m.tags.list())
  }

  updateTag = async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug)
    const body = req.body ?? {}
    let tag = typeof body.name === 'string' ? await this.m.tags.rename(slug, body.name) : null
    if (typeof body.audience === 'boolean') tag = await this.m.tags.setAudience(slug, body.audience)
    res.json(tag ?? (await this.m.tags.list()).find((t) => t.slug === slug) ?? null)
  }

  tagUsage = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.m.tags.usage(String(req.params.slug)))
  }

  removeTag = async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, usage: await this.m.tags.usage(slug) })
      return
    }
    await this.m.tags.remove(slug)
    res.json({ ok: true })
  }
}
