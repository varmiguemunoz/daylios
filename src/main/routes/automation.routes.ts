import { Router } from 'express'
import type { AutomationController } from '../controllers/automation.controller'

export function automationRoutes(c: AutomationController): Router {
  return Router()
    .get('/', c.list)
    .post('/', c.create)
    .get('/catalog', c.catalog)
    .get('/runs', c.runs)
    .get('/runs/:id', c.run)
    .post('/runs/:id/cancel', c.cancel)
    .post('/runs/:id/resume', c.resume)
    .post('/runs/:id/retry', c.retry)
    .get('/:id', c.get)
    .patch('/:id', c.rename)
    .put('/:id/draft', c.saveDraft)
    .post('/:id/publish', c.publish)
    .get('/:id/versions', c.versions)
    .post('/:id/versions/:versionId/restore', c.restore)
    .post('/:id/status', c.setStatus)
    .delete('/:id', c.remove)
    .get('/:id/stats', c.stats)
    .get('/:id/trigger-log', c.triggerLog)
    .get('/:id/steps', c.steps)
    .post('/:id/nodes/:nodeId/retry', c.retryNode)
    .post('/:id/test', c.test)
    .post('/:id/run', c.runManual)
}
