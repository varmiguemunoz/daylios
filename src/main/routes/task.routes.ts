import { Router } from 'express'
import type { TaskController } from '../controllers/task.controller'

export function taskRoutes(c: TaskController): Router {
  return Router()
    .get('/day', c.getDay)
    .get('/tasks-board', c.board)
    .get('/history', c.history)
    .post('/tasks', c.create)
    .post('/reorder', c.reorder)
    .get('/task-tags', c.tagSummaries)
    .patch('/task-tags/:tag', c.renameTag)
    .delete('/task-tags/:tag', c.removeTag)
    .get('/tasks/:id', c.get)
    .patch('/tasks/:id', c.update)
    .post('/tasks/:id/subtasks/reorder', c.reorderSubtasks)
    .post('/tasks/:id/subtasks/complete', c.completeSubtasks)
    .delete('/tasks/:id', c.remove)
    .post('/tasks/:id/move', c.move)
    .post('/carry-over', c.carryOver)
}
