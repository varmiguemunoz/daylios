import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import type { DataSource } from 'typeorm'
import {
  emptyDefinition,
  insert,
  NODES,
  ROOT_SLOT,
  type Definition,
  type NodeDef,
  type TriggerDef
} from '@shared/automations'
import { AutomationEngine } from '../main/automations/engine'
import { createHandlers } from '../main/automations/handlers'
import { ExternalError, type Ports } from '../main/automations/ports'
import {
  AutomationModel,
  AutomationRunModel,
  AutomationVersionModel,
  RunStepModel
} from '../main/models/automation.model'
import { ContactModel } from '../main/models/contact.model'
import { ProspectModel } from '../main/models/prospect.model'
import { ProjectModel } from '../main/models/project.model'
import { TaskModel } from '../main/models/task.model'
import { ContactService } from '../main/services/contact.service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

const notesWritten: { body: string; clients?: string[] }[] = []
const notes = {
  create: async (body: string, links: { clients?: string[] }) => {
    notesWritten.push({ body, clients: links.clients })
    return { id: `note-${notesWritten.length}` }
  }
}

describe('registro de nodos', () => {
  it('cada nodo del catálogo tiene handler y no sobra ninguno', () => {
    const handlers = createHandlers(notes)
    expect(Object.keys(handlers).sort()).toEqual(NODES.map((n) => n.type).sort())
  })
})

describe('acciones reales', () => {
  let db: DataSource
  let contacts: ContactService
  let engine: AutomationEngine
  let sent: { to: string; subject: string; html: string }[]
  let calls: { url: string; body: string | null }[]
  let emailConfigured: boolean
  let httpStatus: number

  const ports = (): Ports => ({
    email: emailConfigured
      ? {
          send: async (input) => void sent.push(input),
          ownerEmail: () => 'yo@daylios.app'
        }
      : null,
    http: {
      request: async ({ url, body }) => {
        calls.push({ url, body })
        if (httpStatus >= 500) throw new ExternalError(`El servidor respondió ${httpStatus}.`, true)
        return { status: httpStatus, body: '{"ok":true,"id":42}' }
      }
    },
    notifier: { notify: () => undefined },
    clock: { now: () => new Date() }
  })

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    contacts = new ContactService(db)
    sent = []
    calls = []
    notesWritten.length = 0
    emailConfigured = true
    httpStatus = 200
    engine = new AutomationEngine(db, { handlers: createHandlers(notes), ports: ports() })
  })
  afterEach(() => db.destroy())

  const trigger = (tag: string): TriggerDef => ({
    id: `t-${tag}`,
    type: 'contact.tag_added',
    params: { tag },
    conditions: []
  })

  const node = (id: string, type: NodeDef['type'], params: NodeDef['params'] = {}): NodeDef => ({
    id,
    type,
    name: id,
    params,
    next: {}
  })

  const chain = (t: TriggerDef, ...nodes: NodeDef[]): Definition => {
    let def: Definition = { ...emptyDefinition('contact'), triggers: [t] }
    let slot = ROOT_SLOT
    for (const n of nodes) {
      def = insert(def, slot, n)
      slot = { parent: n.id, port: 'next' }
    }
    return def
  }

  async function publish(def: Definition): Promise<void> {
    const id = randomUUID()
    const versionId = randomUUID()
    const stamp = new Date().toISOString()
    await db.getRepository(AutomationVersionModel).save({
      id: versionId,
      automationId: id,
      number: 1,
      definition: def,
      publishedAt: stamp,
      publishedBy: null,
      createdAt: stamp,
      updatedAt: stamp
    })
    await db.getRepository(AutomationModel).save({
      id,
      name: 'A',
      status: 'active',
      draft: def,
      versionId,
      versionNumber: 1,
      destructive: false,
      createdAt: stamp,
      updatedAt: `${stamp}${id}`
    })
  }

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await engine.runOnce()
  }

  const steps = async (): Promise<{ nodeId: string; status: string; message: string | null }[]> =>
    db.getRepository(RunStepModel).find({ order: { startedAt: 'ASC' } })

  const firstStage = async (): Promise<string> => {
    const [row] = (await db.query(`SELECT id FROM pipeline_stages ORDER BY position LIMIT 1`)) as {
      id: string
    }[]
    return row.id
  }

  it('tags, campo, notas, prospecto, tarea y email en una sola automatización', async () => {
    const stage = await firstStage()
    await publish(
      chain(
        trigger('webinar'),
        node('t', 'add_tag', { tag: 'nurture' }),
        node('f', 'set_field', { key: 'origen', value: 'webinar de {{contact.first_name}}' }),
        node('n', 'append_contact_note', { text: 'Entró por el webinar.' }),
        node('p', 'create_prospect', { stage, value: 1500 }),
        node('k', 'create_task', {
          title: 'Llamar a {{contact.name}}',
          inDays: 1,
          tags: ['ventas']
        }),
        node('e', 'send_email', {
          subject: 'Hola {{contact.first_name}}',
          body: 'Gracias por venir, **{{contact.first_name}}**.'
        })
      )
    )
    const c = await contacts.create({
      name: 'Ana Pérez',
      email: 'ana@acme.com',
      fields: { company: 'Acme' }
    })
    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { add: ['webinar'] })
    await settle()

    const run = await db.getRepository(AutomationRunModel).findOneByOrFail({ subjectId: c.id })
    expect(run.status).toBe('finished')
    const contact = await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })
    expect(contact.fields.origen).toBe('webinar de Ana')
    expect(contact.notesMd).toContain('Entró por el webinar.')
    expect(contact.prospectId).not.toBeNull()
    const prospect = await db
      .getRepository(ProspectModel)
      .findOneByOrFail({ id: contact.prospectId! })
    expect(prospect.valueUsd).toBe(1500)
    const task = await db.getRepository(TaskModel).findOneByOrFail({ title: 'Llamar a Ana Pérez' })
    expect(task.prospectId).toBe(prospect.id)
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe('Hola Ana')
    expect(sent[0].html).toContain('<strong>Ana</strong>')
    expect(sent[0].html).toContain('RESEND_UNSUBSCRIBE_URL')
  })

  it('el email se omite si el contacto no está suscrito o si el email no está configurado', async () => {
    await publish(chain(trigger('a'), node('e', 'send_email', { subject: 'x', body: 'y' })))
    const c = await contacts.create({ name: 'Sin alta', email: 'b@acme.com' })
    await contacts.tag(c.id, { add: ['a'] })
    await settle()
    expect((await steps()).map((s) => [s.status, s.message])).toEqual([
      ['skipped', 'El contacto no está suscrito.']
    ])

    emailConfigured = false
    engine = new AutomationEngine(db, { handlers: createHandlers(notes), ports: ports() })
    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { remove: ['a'] })
    await contacts.tag(c.id, { add: ['a'] })
    await settle()
    expect((await steps()).at(-1)?.message).toBe('El email no está configurado en este equipo.')
    expect(sent).toHaveLength(0)
  })

  it('el webhook guarda su respuesta para el paso siguiente', async () => {
    await publish(
      chain(
        trigger('a'),
        node('h', 'webhook', {
          method: 'POST',
          url: 'https://hooks.test/{{contact.email}}',
          body: '{"name":"{{contact.name}}"}'
        }),
        node('f', 'set_field', { key: 'hook', value: '{{steps.h.status}}-{{steps.h.body.id}}' })
      )
    )
    const c = await contacts.create({ name: 'Ana', email: 'ana@acme.com' })
    await contacts.tag(c.id, { add: ['a'] })
    await settle()
    expect(calls).toEqual([{ url: 'https://hooks.test/ana@acme.com', body: '{"name":"Ana"}' }])
    const contact = await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })
    expect(contact.fields.hook).toBe('200-42')
  })

  it('crea cliente desde la empresa y un proyecto en él, y deja una nota relacionada', async () => {
    await publish(
      chain(
        trigger('a'),
        node('c', 'create_client', {}),
        node('j', 'create_project', { name: 'Onboarding {{contact.company}}' }),
        node('n', 'create_note', { title: 'Inicio con {{client.name}}', body: 'Primer contacto.' })
      )
    )
    const c = await contacts.create({ name: 'Ana', fields: { company: 'Acme' } })
    await contacts.tag(c.id, { add: ['a'] })
    await settle()
    const contact = await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })
    expect(contact.clientId).not.toBeNull()
    const project = await db
      .getRepository(ProjectModel)
      .findOneByOrFail({ clientId: contact.clientId! })
    expect(project.name).toBe('Onboarding Acme')
    expect(notesWritten).toEqual([
      { body: '# Inicio con Acme\n\nPrimer contacto.', clients: [contact.clientId] }
    ])
  })

  it('borrar contacto lo manda a la papelera', async () => {
    await publish(chain(trigger('baja'), node('d', 'delete_contact')))
    const c = await contacts.create({ name: 'Ana' })
    await contacts.tag(c.id, { add: ['baja'] })
    await settle()
    expect(await db.getRepository(ContactModel).findOneBy({ id: c.id })).toBeNull()
  })
})
