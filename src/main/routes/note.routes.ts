import { Router } from 'express'
import type { NoteController } from '../controllers/note.controller'

export function noteRoutes(c: NoteController): Router {
  return Router()
    .get('/notes', c.list)
    .get('/notes/search', c.search)
    .get('/notes/:id', c.get)
    .get('/notes/:id/view', c.view)
    .post('/notes/:id/links', c.link)
    .delete('/notes/:id/links/:type/:targetId', c.unlink)
    .post('/notes', c.create)
    .patch('/notes/:id', c.update)
    .delete('/notes/:id', c.remove)
}
