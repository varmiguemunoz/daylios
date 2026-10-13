import { Router } from 'express'
import type { ClientController } from '../controllers/client.controller'
import type { ProjectController } from '../controllers/project.controller'
import type { ProspectController } from '../controllers/prospect.controller'
import type { MeetingController } from '../controllers/meeting.controller'
import type { ContextController } from '../controllers/context.controller'
import type { ContactController } from '../controllers/contact.controller'

export interface ConsultoraControllers {
  clients: ClientController
  projects: ProjectController
  prospects: ProspectController
  meetings: MeetingController
  context: ContextController
  contacts: ContactController
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
    .get('/clients/:ref/impact', c.clients.impact)
    .delete('/clients/:ref', c.clients.remove)
    .get('/clients/:ref/documents', c.context.documents)
    .get('/clients/:ref/documents/read', c.context.readDocument)
    .put('/clients/:ref/documents', c.context.writeDocument)
    .patch('/clients/:ref/documents', c.context.renameDocument)
    .delete('/clients/:ref/documents', c.context.trashDocument)

    .post('/projects', c.projects.create)
    .get('/projects/:ref', c.projects.get)
    .patch('/projects/:ref', c.projects.update)
    .delete('/projects/:ref', c.projects.remove)

    .get('/pipeline', c.prospects.pipeline)
    .get('/pipelines', c.prospects.pipelines)
    .post('/pipelines', c.prospects.createPipeline)
    .patch('/pipelines/:ref', c.prospects.updatePipeline)
    .delete('/pipelines/:ref', c.prospects.removePipeline)
    .get('/stages', c.prospects.stages)
    .post('/prospects', c.prospects.create)
    .get('/prospects/:ref', c.prospects.get)
    .patch('/prospects/:ref', c.prospects.update)
    .post('/prospects/:ref/move', c.prospects.move)
    .delete('/prospects/:ref', c.prospects.remove)

    .get('/meetings', c.meetings.list)
    .post('/meetings', c.meetings.create)
    .get('/meetings/:id', c.meetings.get)
    .patch('/meetings/:id', c.meetings.update)
    .delete('/meetings/:id', c.meetings.remove)
    .patch('/meetings/:id/action-items/:index', c.meetings.updateActionItem)
    .post('/meetings/:id/process', c.meetings.process)
    .get('/action-items', c.meetings.actionItems)
    .post('/meetings/import', c.meetings.importRecording)

    .get('/contacts', c.contacts.list)
    .post('/contacts', c.contacts.create)
    .get('/contacts/:id', c.contacts.get)
    .patch('/contacts/:id', c.contacts.update)
    .delete('/contacts/:id', c.contacts.remove)
    .post('/contacts/:id/subscribe', c.contacts.subscribe)
    .post('/contacts/:id/unsubscribe', c.contacts.unsubscribe)
    .post('/contacts/:id/tags', c.contacts.tag)
    .post('/contacts/:id/promote', c.contacts.promote)
    .post('/contacts/:id/convert', c.contacts.convert)
    .post('/contacts/:id/detach-prospect', c.contacts.detachProspect)
}
