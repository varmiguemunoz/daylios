import { Router } from 'express'
import type { ClientController } from '../controllers/client.controller'
import type { ProjectController } from '../controllers/project.controller'
import type { ProspectController } from '../controllers/prospect.controller'
import type { MeetingController } from '../controllers/meeting.controller'
import type { ContextController } from '../controllers/context.controller'

export interface ConsultoraControllers {
  clients: ClientController
  projects: ProjectController
  prospects: ProspectController
  meetings: MeetingController
  context: ContextController
}

/** Rutas de la Consultora, montadas en `/consultora`. `:ref` acepta id o nombre. */
export function consultoraRoutes(c: ConsultoraControllers): Router {
  return Router()
    .get('/overview', c.context.overview)
    .get('/search', c.context.search)
    .post('/notes/append', c.context.appendNote)

    .get('/clients', c.clients.list)
    .post('/clients', c.clients.create)
    .get('/clients/:ref', c.clients.get)
    .patch('/clients/:ref', c.clients.update)
    .get('/clients/:ref/documents', c.context.documents)
    .get('/clients/:ref/documents/read', c.context.readDocument)

    .post('/projects', c.projects.create)
    .get('/projects/:ref', c.projects.get)
    .patch('/projects/:ref', c.projects.update)

    .get('/pipeline', c.prospects.pipeline)
    .post('/prospects', c.prospects.create)
    .get('/prospects/:ref', c.prospects.get)
    .patch('/prospects/:ref', c.prospects.update)
    .post('/prospects/:ref/move', c.prospects.move)

    .get('/meetings', c.meetings.list)
    .post('/meetings', c.meetings.create)
    .get('/meetings/:id', c.meetings.get)
    .patch('/meetings/:id', c.meetings.update)
    .patch('/meetings/:id/action-items/:index', c.meetings.updateActionItem)
    .post('/meetings/:id/process', c.meetings.process)
    .get('/action-items', c.meetings.actionItems)
}
