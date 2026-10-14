import type { Request, Response } from 'express'
import type { MetricKind, MetricPeriod } from '@shared/metrics'
import type { MetricsService } from '../services/metrics.service'
import type { DashboardService } from '../services/dashboard.service'
import { text } from './params'

export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly dashboards: DashboardService
  ) {}

  query = async (req: Request, res: Response): Promise<void> => {
    const q = req.query
    res.json(
      await this.metrics.query({
        period: (text(q.period) ?? 'week') as MetricPeriod,
        from: text(q.from),
        to: text(q.to),
        pipeline: text(q.pipeline),
        assignee: text(q.assignee),
        kinds: text(q.kinds)?.split(',').filter(Boolean) as MetricKind[] | undefined
      })
    )
  }

  dashboard = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.dashboards.get())
  }
}
