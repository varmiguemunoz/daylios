import type { Request, Response } from 'express'
import {
  catalogSummary,
  RUN_STATUSES,
  STEP_STATUSES,
  type AutomationsApi,
  type RunStatus,
  type StepStatus
} from '@shared/automations'
import { int, text } from './params'

const id = (req: Request): string => String(req.params.id)

export class AutomationController {
  constructor(private readonly a: AutomationsApi) {}

  catalog = (_req: Request, res: Response): void => {
    res.json(catalogSummary())
  }

  list = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.a.list())
  }

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.get(id(req)))
  }

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.a.create(req.body ?? {}))
  }

  rename = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.rename(id(req), req.body?.name))
  }

  saveDraft = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.saveDraft(id(req), req.body?.definition))
  }

  publish = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.a.publish(id(req), {
        acknowledgeDestructive: req.body?.acknowledgeDestructive === true
      })
    )
  }

  versions = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.versions(id(req)))
  }

  restore = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.restore(id(req), String(req.params.versionId)))
  }

  setStatus = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.setStatus(id(req), req.body?.status))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.a.remove(id(req))
    res.json({ ok: true })
  }

  stats = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.stats(id(req)))
  }

  triggerLog = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.triggerLog(id(req), int(req.query.limit)))
  }

  steps = async (req: Request, res: Response): Promise<void> => {
    const status = text(req.query.status)
    res.json(
      await this.a.steps({
        automationId: id(req),
        nodeId: text(req.query.nodeId),
        status: STEP_STATUSES.includes(status as StepStatus) ? (status as StepStatus) : undefined,
        limit: int(req.query.limit)
      })
    )
  }

  retryNode = async (req: Request, res: Response): Promise<void> => {
    res.json({ retried: await this.a.retryNode(id(req), String(req.params.nodeId)) })
  }

  test = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.a.test({
        id: id(req),
        definition: req.body?.definition,
        subjectId: text(req.body?.subjectId) ?? null
      })
    )
  }

  runManual = async (req: Request, res: Response): Promise<void> => {
    await this.a.runManual(id(req), text(req.body?.subjectId) ?? null)
    res.status(202).json({ queued: true })
  }

  runs = async (req: Request, res: Response): Promise<void> => {
    const status = text(req.query.status)
    res.json(
      await this.a.runs({
        automationId: text(req.query.automationId),
        subjectId: text(req.query.subjectId),
        status: RUN_STATUSES.includes(status as RunStatus) ? (status as RunStatus) : undefined,
        limit: int(req.query.limit),
        offset: int(req.query.offset)
      })
    )
  }

  run = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.run(id(req)))
  }

  cancel = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.cancel(id(req)))
  }

  resume = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.resume(id(req)))
  }

  retry = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.a.retry(id(req)))
  }
}
