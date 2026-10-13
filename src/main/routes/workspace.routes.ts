import { Router } from 'express'
import type { WorkspaceController } from '../controllers/workspace.controller'

/** Rutas del workspace bajo `/workspace`. `:ref` = id o ruta de la bóveda (codificada). */
export function workspaceRoutes(c: WorkspaceController): Router {
  return Router()
    .get('/info', c.info)
    .get('/tree', c.tree)
    .get('/list', c.list)
    .get('/search', c.search)
    .post('/folders', c.createFolder)
    .post('/notes', c.createNote)
    .post('/boards', c.createBoard)
    .get('/items/:ref', c.get)
    .get('/items/:ref/impact', c.impact)
    .patch('/items/:ref', c.update)
    .put('/notes/:ref', c.writeNote)
    .get('/boards/:ref', c.board)
    .put('/boards/:ref', c.writeBoard)
    .post('/boards/:ref/ops', c.boardOps)
    .delete('/items/:ref', c.remove)
}
