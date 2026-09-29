import { randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import express from 'express'
import type { TaskService } from './services/task.service'
import { TaskController } from './controllers/task.controller'
import { taskRoutes } from './routes/task.routes'
import { requireToken } from './middlewares/auth.middleware'
import { notifyOnWrite } from './middlewares/notify.middleware'
import { errorHandler, notFound } from './middlewares/error.middleware'

/** Lo que el MCP lee para conectarse. */
export interface Connection {
  port: number
  token: string
}

/**
 * API local en Express, solo en 127.0.0.1 y con token. Es la puerta de Claude (vía MCP).
 * Al arrancar escribe `connection.json` (puerto + token, permisos 600) junto a la base de datos.
 */
export function startServer(
  service: TaskService,
  dir: string,
  onChange: () => void
): Promise<Connection> {
  const token = randomBytes(32).toString('hex')

  const app = express()
  app.disable('x-powered-by')
  app.use(requireToken(token))
  app.use(express.json({ limit: '16kb' }))
  app.use(notifyOnWrite(onChange))
  app.use(taskRoutes(new TaskController(service)))
  app.use(notFound)
  app.use(errorHandler)

  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) return reject(error)
      const { port } = server.address() as { port: number }
      const connection = { port, token }
      writeFileSync(join(dir, 'connection.json'), JSON.stringify(connection), { mode: 0o600 })
      resolve(connection)
    })
  })
}
