import { randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import express from 'express'
import type { TaskService } from './services/task.service'
import type { NoteService } from './services/note.service'
import { TaskController } from './controllers/task.controller'
import { NoteController } from './controllers/note.controller'
import { taskRoutes } from './routes/task.routes'
import { noteRoutes } from './routes/note.routes'
import { consultoraRoutes } from './routes/consultora.routes'
import { ClientController } from './controllers/client.controller'
import { ProjectController } from './controllers/project.controller'
import { ProspectController } from './controllers/prospect.controller'
import { MeetingController } from './controllers/meeting.controller'
import { ContextController } from './controllers/context.controller'
import { ContactController } from './controllers/contact.controller'
import type { Consultora } from './consultora'
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
  services: { tasks: TaskService; notes: NoteService; consultora: Consultora },
  dir: string,
  onChange: () => void
): Promise<Connection> {
  const token = randomBytes(32).toString('hex')

  const app = express()
  app.disable('x-powered-by')
  app.use(requireToken(token))
  // Una nota puede tener hasta 100 000 caracteres (con acentos, más bytes).
  app.use(express.json({ limit: '512kb' }))
  app.use(notifyOnWrite(onChange))
  app.use(taskRoutes(new TaskController(services.tasks)))
  app.use(noteRoutes(new NoteController(services.notes)))

  const c = services.consultora
  app.use(
    '/consultora',
    consultoraRoutes({
      clients: new ClientController(c.clients),
      projects: new ProjectController(c.projects),
      prospects: new ProspectController(c.prospects),
      meetings: new MeetingController(c.meetings, c.recordings),
      context: new ContextController(c.context),
      contacts: new ContactController(c.contacts)
    })
  )
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
