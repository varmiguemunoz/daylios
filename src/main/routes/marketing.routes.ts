import { Router } from 'express'
import type { MarketingController } from '../controllers/marketing.controller'

/** Rutas del email marketing, montadas en `/marketing`. Los contactos viven en `/consultora/contacts`. */
export function marketingRoutes(c: MarketingController): Router {
  return Router()
    .get('/status', c.status)
    .get('/sources', c.sources)
    .post('/sources', c.createSource)
    .patch('/sources/:slug', c.updateSource)
    .post('/sources/:slug/rotate', c.rotateSource)
    .delete('/sources/:slug', c.removeSource)
    .post('/sync', c.syncNow)
    .get('/rules', c.rules)
    .post('/rules', c.createRule)
    .patch('/rules/:id', c.updateRule)
    .delete('/rules/:id', c.removeRule)
    .get('/sequences', c.sequences)
    .post('/sequences', c.saveSequence)
    .get('/sequences/:id', c.sequence)
    .post('/sequences/:id/status', c.sequenceStatus)
    .get('/newsletters', c.newsletters)
    .get('/newsletters/context', c.newsletterContext)
    .post('/newsletters', c.sendNewsletter)
    .get('/newsletters/:id', c.newsletter)
    .get('/tags', c.tags)
    .patch('/tags/:slug', c.updateTag)
    .get('/tags/:slug/usage', c.tagUsage)
    .delete('/tags/:slug', c.removeTag)
}
