import { timingSafeEqual } from 'crypto'
import type { RequestHandler } from 'express'
import { errorView } from '../views/task.view'

/** Exige `Authorization: Bearer <token>`. Comparación en tiempo constante. */
export function requireToken(token: string): RequestHandler {
  const expected = Buffer.from(`Bearer ${token}`)
  return (req, res, next) => {
    const given = Buffer.from(req.headers.authorization ?? '')
    if (given.length === expected.length && timingSafeEqual(given, expected)) return next()
    res.status(401).json(errorView('Token inválido.'))
  }
}
