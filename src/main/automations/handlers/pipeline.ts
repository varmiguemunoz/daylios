import { normalizeName } from '@shared/consultora'
import { randomUUID } from 'crypto'
import { ClientModel } from '../../models/client.model'
import { ContactModel } from '../../models/contact.model'
import { ProjectModel } from '../../models/project.model'
import { ProspectModel } from '../../models/prospect.model'
import { promoteContact } from '../../services/contact.service'
import { insertClient } from '../../services/client.service'
import { moveProspect, removeProspect } from '../../services/prospect.service'
import type { Handlers } from '../ports'
import {
  clientIdOf,
  contactOf,
  done,
  guarded,
  manager,
  numberParam,
  param,
  prospectOf,
  Skip,
  today
} from './shared'

export const PIPELINE_HANDLERS: Handlers = {
  create_prospect: {
    run: guarded(async (ctx) => {
      const contact = await contactOf(ctx)
      if (contact.prospectId) throw new Skip('Ya está en el pipeline.')
      const prospect = await promoteContact(manager(ctx), contact, param(ctx, 'stage'), {
        pipeline: param(ctx, 'pipeline') || undefined,
        valueUsd: numberParam(ctx, 'value')
      })
      return done({ prospectId: prospect.id })
    })
  },
  move_prospect: {
    run: guarded(async (ctx) => {
      const prospect = await prospectOf(ctx)
      if (prospect.stageId === param(ctx, 'stage')) throw new Skip('Ya está en esa etapa.')
      await moveProspect(
        manager(ctx),
        prospect.id,
        param(ctx, 'stage'),
        undefined,
        param(ctx, 'pipeline') || undefined
      )
      return done()
    })
  },
  update_prospect: {
    run: guarded(async (ctx) => {
      const prospect = await prospectOf(ctx)
      const value = numberParam(ctx, 'value')
      const nextStep = ctx.render(param(ctx, 'nextStep')).trim()
      const inDays = numberParam(ctx, 'inDays')
      if (value !== null) prospect.valueUsd = Math.max(0, value)
      if (nextStep) prospect.nextStep = nextStep
      if (inDays !== null) prospect.nextStepDate = today(ctx, Math.max(0, Math.floor(inDays)))
      prospect.updatedAt = ctx.ports.clock.now().toISOString()
      await manager(ctx).getRepository(ProspectModel).save(prospect)
      return done()
    })
  },
  delete_prospect: {
    run: guarded(async (ctx) => {
      const prospect = await prospectOf(ctx)
      await removeProspect(manager(ctx), prospect.id)
      return done()
    })
  },
  create_client: {
    run: guarded(async (ctx) => {
      const m = manager(ctx)
      if (clientIdOf(ctx)) throw new Skip('Ya tiene cliente.')
      const prospect = ctx.scope.prospect ? await prospectOf(ctx) : null
      const contact = ctx.scope.contact ? await contactOf(ctx) : null
      const company =
        typeof contact?.fields.company === 'string' ? contact.fields.company.trim() : ''
      const name = ctx.render(param(ctx, 'name')).trim() || prospect?.company || company
      if (!name) throw new Skip('No hay nombre para el cliente.')
      const existing = (await m.getRepository(ClientModel).find()).find(
        (c) => normalizeName(c.name) === normalizeName(name)
      )
      const client =
        existing ?? (await insertClient(m, { name, contactsMd: prospect?.contactMd ?? '' }))
      if (prospect)
        await m.getRepository(ProspectModel).update({ id: prospect.id }, { clientId: client.id })
      if (contact)
        await m.getRepository(ContactModel).update({ id: contact.id }, { clientId: client.id })
      return done({ clientId: client.id })
    })
  },
  create_project: {
    run: guarded(async (ctx) => {
      const clientId = clientIdOf(ctx)
      if (!clientId) throw new Skip('No tiene cliente.')
      const name = ctx.render(param(ctx, 'name')).trim()
      if (!name) throw new Skip('El nombre quedó vacío.')
      const stamp = ctx.ports.clock.now().toISOString()
      const id = randomUUID()
      await manager(ctx)
        .getRepository(ProjectModel)
        .insert({
          id,
          clientId,
          name: name.slice(0, 200),
          status: 'activo',
          objectiveMd: '',
          deliverablesMd: '',
          notesMd: '',
          assigneeId: null,
          createdAt: stamp,
          updatedAt: stamp
        })
      return done({ projectId: id })
    })
  }
}
