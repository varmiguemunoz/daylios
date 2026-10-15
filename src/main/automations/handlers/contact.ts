import { normalizeName } from '@shared/consultora'
import { ContactModel } from '../../models/contact.model'
import { ClientModel } from '../../models/client.model'
import { ProjectModel } from '../../models/project.model'
import { changedFields, changeTags, removeContact, setStatus } from '../../services/contact.service'
import { insertClient } from '../../services/client.service'
import { emit } from '../events'
import type { Handlers } from '../ports'
import { contactOf, done, guarded, manager, param, Skip } from './shared'

const EDITABLE = ['name', 'role', 'phone', 'linkedin'] as const

export const CONTACT_HANDLERS: Handlers = {
  add_tag: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      await changeTags(manager(ctx), contact, {
        add: [param(ctx, 'tag')],
        remove: []
      })
      return done()
    })
  },
  remove_tag: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      await changeTags(manager(ctx), contact, {
        add: [],
        remove: [param(ctx, 'tag')]
      })
      return done()
    })
  },
  update_contact: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      const field = param(ctx, 'field') as (typeof EDITABLE)[number]
      if (!EDITABLE.includes(field)) throw new Skip('Ese dato no se puede cambiar.')
      const before = { ...contact, fields: { ...contact.fields } }
      const value = ctx.render(param(ctx, 'value')).trim()
      contact[field] = value || null
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      const fields = changedFields(before, contact)
      if (fields.length)
        await emit(manager(ctx), 'contact.updated', { type: 'contact', id: contact.id }, { fields })
      return done()
    })
  },
  set_field: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      const key = param(ctx, 'key')
      if (!key) throw new Skip('Falta el nombre del campo.')
      const before = { ...contact, fields: { ...contact.fields } }
      contact.fields = { ...contact.fields, [key]: ctx.render(param(ctx, 'value')) }
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      const fields = changedFields(before, contact)
      if (fields.length)
        await emit(manager(ctx), 'contact.updated', { type: 'contact', id: contact.id }, { fields })
      return done()
    })
  },
  append_contact_note: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      const text = ctx.render(param(ctx, 'text')).trim()
      if (!text) throw new Skip('El texto quedó vacío.')
      contact.notesMd = contact.notesMd.trim() ? `${contact.notesMd.trimEnd()}\n\n${text}` : text
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      return done()
    })
  },
  assign_client: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      const clients = manager(ctx).getRepository(ClientModel)
      let clientId: string
      if (param(ctx, 'from') === 'company') {
        const company =
          typeof contact.fields.company === 'string' ? contact.fields.company.trim() : ''
        if (!company) throw new Skip('El contacto no tiene empresa.')
        const all = await clients.find()
        const found = all.find((c) => normalizeName(c.name) === normalizeName(company))
        clientId = found ? found.id : (await insertClient(manager(ctx), { name: company })).id
      } else {
        const client = await clients.findOneBy({ id: param(ctx, 'client') })
        if (!client) throw new Skip('El cliente ya no existe.')
        clientId = client.id
      }
      contact.clientId = clientId
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      return done({ clientId })
    })
  },
  unassign_client: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      if (!contact.clientId) throw new Skip('No tiene cliente.')
      contact.clientId = null
      contact.projectId = null
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      return done()
    })
  },
  assign_project: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      const project = await manager(ctx)
        .getRepository(ProjectModel)
        .findOneBy({ id: param(ctx, 'project') })
      if (!project) throw new Skip('El proyecto ya no existe.')
      contact.projectId = project.id
      contact.clientId = project.clientId
      contact.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ContactModel).save(contact)
      return done()
    })
  },
  unsubscribe: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      if (contact.status === 'unsubscribed') throw new Skip('Ya estaba dado de baja.')
      await setStatus(manager(ctx), contact, 'unsubscribed', 'automation')
      return done()
    })
  },
  delete_contact: {
    run: guarded(async (ctx) => {
      await removeContact(manager(ctx), await contactOf(ctx))
      return done()
    })
  }
}
