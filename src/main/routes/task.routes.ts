import { Router } from 'express'
import type { TaskController } from '../controllers/task.controller'

/** Rutas de la API local. Cada una apunta a un método del controlador. */
export function taskRoutes(c: TaskController): Router {
  return Router()
    .get('/day', c.getDay)
    .get('/history', c.history)
    .post('/tasks', c.create)
    .patch('/tasks/:id', c.update)
    .delete('/tasks/:id', c.remove)
    .post('/tasks/:id/move', c.move)
    .post('/carry-over', c.carryOver)
}
