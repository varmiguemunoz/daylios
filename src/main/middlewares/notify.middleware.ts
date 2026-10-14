import type { RequestHandler } from 'express'

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
