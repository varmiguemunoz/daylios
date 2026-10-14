import type { Request, Response } from 'express'
import type { ProspectService } from '../services/prospect.service'
import { text } from './params'

export class ProspectController {
  constructor(private readonly service: ProspectService) {}

  pipeline = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.pipeline(text(req.query.pipeline)))
  }

  pipelines = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listPipelines())
  }

  createPipeline = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.savePipeline({ ...(req.body ?? {}), id: undefined }))
  }

  updatePipeline = async (req: Request, res: Response): Promise<void> => {
    const pipeline = await this.service.pipeline(String(req.params.ref))
    res.json(
      await this.service.savePipeline({
        name: pipeline.pipeline.name,
        ...(req.body ?? {}),
        id: pipeline.pipeline.id
      })
    )
  }

  removePipeline = async (req: Request, res: Response): Promise<void> => {
    const ref = String(req.params.ref)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, pipeline: await this.service.pipeline(ref) })
      return
    }
    const to = text(req.query.moveToPipeline)
    await this.service.removePipeline(
      ref,
      to ? { pipeline: to, stage: text(req.query.moveToStage) } : undefined
    )
    res.json({ ok: true })
  }

  stages = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listStages(text(req.query.pipeline)))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    const ref = String(req.params.ref)
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, prospect: await this.service.get(ref) })
      return
    }
    await this.service.remove(ref)
    res.json({ ok: true })
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

  move = async (req: Request, res: Response): Promise<void> => {
    const index = typeof req.body?.index === 'number' ? req.body.index : undefined
    res.json(
      await this.service.move(String(req.params.ref), req.body?.stage, index, req.body?.pipeline)
    )
  }
}
