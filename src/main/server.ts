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
import { MetricsController } from './controllers/metrics.controller'
import type { Consultora } from './consultora'
import type { Marketing } from './marketing'
import { MarketingController } from './controllers/marketing.controller'
import type { WorkspaceService } from './services/workspace.service'
import { WorkspaceController } from './controllers/workspace.controller'
import { workspaceRoutes } from './routes/workspace.routes'
import { marketingRoutes } from './routes/marketing.routes'
import type { AutomationsApi } from '@shared/automations'
import { AutomationController } from './controllers/automation.controller'
import { automationRoutes } from './routes/automation.routes'
import { requireToken } from './middlewares/auth.middleware'
import { notifyOnWrite } from './middlewares/notify.middleware'
import { errorHandler, notFound } from './middlewares/error.middleware'

export interface Connection {
  port: number
  token: string
}

export function startServer(
  services: {
    tasks: TaskService
    notes: NoteService
    consultora: Consultora
    marketing: Marketing
    workspace: WorkspaceService
    automations: AutomationsApi
  },
  dir: string,
  onChange: () => void
): Promise<Connection> {
  const token = randomBytes(32).toString('hex')

  const app = express()
  app.disable('x-powered-by')
  app.get('/health', (_req, res) => {
    res.json({ ok: true, pid: process.pid })
  })
  app.use(requireToken(token))
  // Una nota puede tener hasta 100 000 caracteres (con acentos, más bytes).
  // Boards grandes (JSON Canvas) pueden pasar de 512 KB.
  app.use(express.json({ limit: '4mb' }))
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
      contacts: new ContactController(c.contacts),
      metrics: new MetricsController(c.metrics, c.dashboards)
    })
  )
  app.use('/marketing', marketingRoutes(new MarketingController(services.marketing)))
  app.use('/workspace', workspaceRoutes(new WorkspaceController(services.workspace)))
  app.use('/automations', automationRoutes(new AutomationController(services.automations)))
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
