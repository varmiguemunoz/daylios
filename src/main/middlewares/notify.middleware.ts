import type { RequestHandler } from 'express'

/** Tras cada escritura exitosa (no GET) avisa a la ventana para que se refresque. */
export function notifyOnWrite(onChange: () => void): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) onChange()
      })
    }
    next()
  }
}
