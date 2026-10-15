import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { insert, ROOT_SLOT, type Definition, type NodeDef } from '@shared/automations'
import { AutomationEngine } from '../main/automations/engine'
import { createHandlers } from '../main/automations/handlers'
import { AutomationService } from '../main/automations/service'
import type { Ports } from '../main/automations/ports'
import { AutomationVersionModel } from '../main/models/automation.model'
import { ContactModel } from '../main/models/contact.model'
import { ContactService } from '../main/services/contact.service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

const notes = { create: async () => ({ id: 'n' }) }

const ports: Ports = {
  email: null,
  http: { request: async () => ({ status: 200, body: '' }) },
  notifier: { notify: () => undefined },
  clock: { now: () => new Date() }
}

const node = (id: string, type: NodeDef['type'], params: NodeDef['params'] = {}): NodeDef => ({
  id,
  type,
  name: id,
  params,
  next: {}
})

describe('AutomationService', () => {
  let db: DataSource
  let engine: AutomationEngine
  let service: AutomationService
  let contacts: ContactService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    engine = new AutomationEngine(db, { handlers: createHandlers(notes), ports })
    service = new AutomationService({
      db,
      kick: () => undefined,
      invalidate: () => engine.cache.invalidate()
    })
    contacts = new ContactService(db)
  })
  afterEach(() => db.destroy())

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await engine.runOnce()
  }

  async function draft(build: (def: Definition) => Definition): Promise<string> {
    const { automation } = await service.create({ name: 'Bienvenida', subject: 'contact' })
    await service.saveDraft(automation.id, build(automation.draft))
    return automation.id
  }

  it('no publica con errores y publica versiones numeradas', async () => {
    const id = await draft((d) => insert(d, ROOT_SLOT, node('a', 'add_tag', {})))
    await expect(service.publish(id)).rejects.toThrow(/No se puede publicar/)
    const def = (await service.get(id)).automation.draft
    def.nodes.a.params = { tag: 'nurture' }
    def.triggers = [{ id: 't', type: 'contact.created', params: {}, conditions: [] }]
    await service.saveDraft(id, def)
    const first = await service.publish(id)
    expect(first.automation.status).toBe('active')
    expect(first.automation.versionNumber).toBe(1)
    expect(first.hasDraftChanges).toBe(false)
    await service.rename(id, 'Otra')
    await service.publish(id)
    const versions = await service.versions(id)
    expect(versions.map((v) => [v.number, v.current])).toEqual([
      [2, true],
      [1, false]
    ])
    const list = await service.list()
    expect(list[0].sentence.toLowerCase()).toContain('nurture')
  })

  it('pide confirmación para publicar algo que borra', async () => {
    const id = await draft((d) => ({
      ...insert(d, ROOT_SLOT, node('d', 'delete_contact')),
      triggers: [{ id: 't', type: 'contact.created', params: {}, conditions: [] }]
    }))
    await expect(service.publish(id)).rejects.toThrow(/borra registros/)
    expect(
      (await service.publish(id, { acknowledgeDestructive: true })).automation.destructive
    ).toBe(true)
  })

  it('no deja cambiar el sujeto ni meter nodos desconocidos', async () => {
    const id = await draft((d) => d)
    const def = (await service.get(id)).automation.draft
    await expect(service.saveDraft(id, { ...def, subject: 'client' })).rejects.toThrow(/sujeto/)
    await expect(
      service.saveDraft(id, {
        ...def,
        nodes: { x: { ...node('x', 'add_tag'), type: 'boom' as never } }
      })
    ).rejects.toThrow(/desconocido/)
  })

  it('ejecuta a mano sin trigger manual y el dry run no escribe', async () => {
    const id = await draft((d) => ({
      ...insert(
        d,
        ROOT_SLOT,
        node('f', 'set_field', { key: 'saludo', value: 'Hola {{contact.first_name}}' })
      ),
      triggers: [{ id: 't', type: 'contact.created', params: {}, conditions: [] }]
    }))
    await service.publish(id)
    const c = await contacts.create({ name: 'Ana Pérez' })
    await settle()
    await db.getRepository(ContactModel).update({ id: c.id }, { fields: {} })

    const result = await service.test({ id, subjectId: c.id })
    expect(result.subjectLabel).toBe('Ana Pérez')
    expect(result.steps[0].rendered).toEqual({ Valor: 'Hola Ana' })
    expect((await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })).fields).toEqual({})

    await service.runManual(id, c.id)
    await settle()
    expect((await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })).fields.saludo).toBe(
      'Hola Ana'
    )
    const runs = await service.runs({ automationId: id })
    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.status === 'finished' && r.subjectLabel === 'Ana Pérez')).toBe(true)
  })

  it('encuentra referencias y borra cancelando ejecuciones abiertas', async () => {
    const id = await draft((d) => ({
      ...insert(
        insert(d, ROOT_SLOT, node('w', 'wait', { mode: 'delay', amount: 1, unit: 'days' })),
        { parent: 'w', port: 'next' },
        node('a', 'add_tag', { tag: 'vip' })
      ),
      triggers: [{ id: 't', type: 'contact.created', params: {}, conditions: [] }]
    }))
    await service.publish(id)
    expect(await service.references('tag', 'vip')).toEqual([{ id, name: 'Bienvenida' }])
    expect(await service.references('tag', 'otro')).toEqual([])
    await contacts.create({ name: 'Ana' })
    await settle()
    const [waiting] = await service.runs({ automationId: id })
    expect(waiting.status).toBe('waiting')
    expect(waiting.nodeName).toBe('w')
    await service.remove(id)
    expect((await service.run(waiting.id)).run.status).toBe('cancelled')
    expect(await service.list()).toEqual([])
    expect(await db.getRepository(AutomationVersionModel).countBy({ automationId: id })).toBe(1)
  })

  it('suscribir a mano dispara contact.subscribed', async () => {
    const id = await draft((d) => ({
      ...insert(d, ROOT_SLOT, node('a', 'add_tag', { tag: 'bienvenida' })),
      triggers: [{ id: 't', type: 'contact.subscribed', params: {}, conditions: [] }]
    }))
    await service.publish(id)
    const c = await contacts.create({ name: 'Ana', email: 'ana@acme.com' })
    await contacts.subscribe(c.id)
    await settle()
    expect((await contacts.get(c.id)).tags.map((t) => t.slug)).toEqual(['bienvenida'])
  })
})
