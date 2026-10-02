import { Router } from 'express'
import type { NoteController } from '../controllers/note.controller'

/** Rutas de notas. Cada una apunta a un método del controlador. */
export function noteRoutes(c: NoteController): Router {
  return Router()
    .get('/notes', c.list)
    .get('/notes/:id', c.get)
    .post('/notes', c.create)
    .patch('/notes/:id', c.update)
    .delete('/notes/:id', c.remove)
}
