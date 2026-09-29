import type { ErrorRequestHandler, RequestHandler } from 'express'
import { TaskError, type TaskErrorCode } from '../services/task.service'
import { errorView } from '../views/task.view'

const STATUS: Record<TaskErrorCode, number> = { invalid: 400, not_found: 404, day_full: 409 }

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json(errorView('Ruta no encontrada.'))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof TaskError) {
    res.status(STATUS[error.code]).json(errorView(error.message, error.code))
    return
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json(errorView('JSON inválido.'))
    return
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json(errorView('Cuerpo demasiado grande.'))
    return
  }
  res.status(500).json(errorView('Error interno.'))
}
