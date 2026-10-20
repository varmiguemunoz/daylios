import { Router } from 'express'
import type { MarketingController } from '../controllers/marketing.controller'

export function marketingRoutes(c: MarketingController): Router {
  return Router()
    .get('/status', c.status)
    .get('/outreach/status', c.outreachStatus)
    .get('/outreach/sequences', c.outreachSequences)
    .post('/outreach/sequences', c.saveOutreachSequence)
    .get('/outreach/sequences/:id', c.outreachSequence)
    .post('/outreach/sequences/:id/status', c.outreachSequenceStatus)
    .post('/outreach/sequences/:id/archive', c.archiveOutreachSequence)
    .post('/outreach/enroll', c.enrollOutreach)
    .post('/outreach/poll', c.pollOutreach)
    .get('/sources', c.sources)
    .post('/sources', c.createSource)
    .patch('/sources/:slug', c.updateSource)
    .post('/sources/:slug/rotate', c.rotateSource)
    .delete('/sources/:slug', c.removeSource)
    .post('/sync', c.syncNow)
    .get('/newsletters', c.newsletters)
    .get('/newsletters/context', c.newsletterContext)
    .post('/newsletters', c.sendNewsletter)
    .get('/newsletters/:id', c.newsletter)
    .get('/tags', c.tags)
    .patch('/tags/:slug', c.updateTag)
    .get('/tags/:slug/usage', c.tagUsage)
    .delete('/tags/:slug', c.removeTag)
}
