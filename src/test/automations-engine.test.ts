import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import type { DataSource } from 'typeorm'
import {
  emptyDefinition,
  insert,
  ROOT_SLOT,
  type Definition,
  type NodeDef,
  type TriggerDef
} from '@shared/automations'
import { AutomationEngine } from '../main/automations/engine'
import { CONTROL_HANDLERS } from '../main/automations/handlers/control'
import { ExternalError, type Handlers, type Ports } from '../main/automations/ports'
import {
  AutomationEventModel,
  AutomationModel,
  AutomationRunModel,
  AutomationVersionModel,
  RunStepModel,
  TriggerLogModel
} from '../main/models/automation.model'
import { ContactModel } from '../main/models/contact.model'
import { ContactService, changeTags } from '../main/services/contact.service'
import { transactionGuard } from '../main/guards/transaction.guard'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

const HOUR = 60 * 60_000

class FakeClock {
  t = new Date('2026-10-14T15:00:00.000Z').getTime()
  now = (): Date => new Date(this.t)
  advance(ms: number): void {
    this.t += ms
  }
}

const node = (id: string, type: NodeDef['type'], params: NodeDef['params'] = {}): NodeDef => ({
  id,
  type,
  name: id,
  params,
  next: {}
})

const tagTrigger = (tag: string): TriggerDef => ({
  id: `t-${tag}`,
  type: 'contact.tag_added',
  params: { tag },
  conditions: []
})

describe('AutomationEngine', () => {
  let db: DataSource
  let clock: FakeClock
  let contacts: ContactService
  let engine: AutomationEngine
  let notices: string[]
  let webhookFails: number
  let alerts: string[]

  const handlers = (): Handlers => ({
    ...CONTROL_HANDLERS,
    notify_mac: {
      run: async (ctx) => (
        notices.push(ctx.render(String(ctx.node.params.title))),
        { kind: 'next' }
      )
    },
    webhook: {
      run: async () => {
        if (webhookFails > 0) {
          webhookFails--
          throw new ExternalError('El servidor respondió 500.', true)
        }
        return { kind: 'next', output: { status: 200 } }
      }
    },
    add_tag: {
      run: async (ctx) => {
        const contact = await ctx
          .manager!.getRepository(ContactModel)
          .findOneByOrFail({ id: ctx.run.subjectId! })
        await changeTags(ctx.manager!, contact, {
          add: [String(ctx.node.params.tag)],
          remove: []
        })
        return { kind: 'next' }
      }
    },
    remove_tag: {
      run: async (ctx) => {
        const contact = await ctx
          .manager!.getRepository(ContactModel)
          .findOneByOrFail({ id: ctx.run.subjectId! })
        await changeTags(ctx.manager!, contact, {
          add: [],
          remove: [String(ctx.node.params.tag)]
        })
        return { kind: 'next' }
      }
    }
  })

  const ports = (): Ports => ({
    email: null,
    http: { request: async () => ({ status: 200, body: '' }) },
    notifier: { notify: () => undefined },
    clock
  })

  const build = (): AutomationEngine =>
    new AutomationEngine(db, {
      handlers: handlers(),
      ports: ports(),
      onAlert: (_, m) => alerts.push(m)
    })

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    clock = new FakeClock()
    contacts = new ContactService(db)
    notices = []
    alerts = []
    webhookFails = 0
    engine = build()
  })
  afterEach(() => db.destroy())

  async function publish(
    def: Definition,
    name = 'A',
    id: string = randomUUID()
  ): Promise<{ id: string; versionId: string }> {
    const stamp = clock.now().toISOString()
    const versions = await db
      .getRepository(AutomationVersionModel)
      .count({ where: { automationId: id } })
    const versionId = randomUUID()
    await db.getRepository(AutomationVersionModel).save({
      id: versionId,
      automationId: id,
      number: versions + 1,
      definition: def,
      publishedAt: stamp,
      publishedBy: null,
      createdAt: stamp,
      updatedAt: stamp
    })
    await db.getRepository(AutomationModel).save({
      id,
      name,
      status: 'active',
      draft: def,
      versionId,
      versionNumber: versions + 1,
      destructive: false,
      createdAt: stamp,
      updatedAt: `${stamp}#${versions}`
    })
    return { id, versionId }
  }

  const chain = (trigger: TriggerDef, ...nodes: NodeDef[]): Definition => {
    let def: Definition = { ...emptyDefinition('contact'), triggers: [trigger] }
    let slot = ROOT_SLOT
    for (const n of nodes) {
      def = insert(def, slot, n)
      const port = Object.keys(def.nodes[n.id].next)[0]
      slot = { parent: n.id, port }
    }
    return def
  }

  const tag = async (contactId: string, value: string): Promise<void> => {
    await contacts.tag(contactId, { add: [value] })
  }

  const runs = (): Promise<
    { status: string; nodeId: string | null; late: boolean; reason: string | null }[]
  > => db.getRepository(AutomationRunModel).find({ order: { createdAt: 'ASC' } })

  it('inscribe al añadir el tag, ejecuta los pasos y deja registro', async () => {
    await publish(
      chain(tagTrigger('webinar'), node('n1', 'notify_mac', { title: 'Hola {{contact.name}}' }))
    )
    const c = await contacts.create({ name: 'Ana', email: 'ana@acme.com' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    expect(notices).toEqual(['Hola Ana'])
    const [run] = await runs()
    expect(run.status).toBe('finished')
    const steps = await db.getRepository(RunStepModel).find()
    expect(steps.map((s) => s.status)).toEqual(['ok'])
  })

  it('no inscribe dos veces mientras sigue dentro y lo registra', async () => {
    await publish(
      chain(tagTrigger('webinar'), node('w', 'wait', { mode: 'delay', amount: 1, unit: 'days' }))
    )
    const c = await contacts.create({ name: 'Ana', email: 'ana@acme.com' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    await contacts.tag(c.id, { remove: ['webinar'] })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    expect(await runs()).toHaveLength(1)
    const outcomes = (await db.getRepository(TriggerLogModel).find()).map((l) => l.outcome)
    expect(outcomes).toEqual(['enrolled', 'already_enrolled'])
  })

  it('espera por tiempo, sobrevive a un reinicio y marca «con retraso»', async () => {
    await publish(
      chain(
        tagTrigger('webinar'),
        node('w', 'wait', { mode: 'delay', amount: 1, unit: 'hours' }),
        node('n', 'notify_mac', { title: 'listo' })
      )
    )
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    expect((await runs())[0].status).toBe('waiting')
    clock.advance(3 * HOUR)
    const restarted = build()
    await restarted.recover()
    await restarted.runOnce()
    const [run] = await runs()
    expect(run.status).toBe('finished')
    expect(run.late).toBe(true)
    expect(notices).toEqual(['listo'])
    const statuses = (
      await db.getRepository(RunStepModel).find({ order: { startedAt: 'ASC' } })
    ).map((s) => s.status)
    expect(statuses).toEqual(['ok', 'ok'])
  })

  it('la espera por condición sale por «se cumplió» al llegar el evento', async () => {
    let def = chain(tagTrigger('webinar'))
    def = insert(
      def,
      ROOT_SLOT,
      node('w', 'wait', {
        mode: 'condition',
        timeout: 1,
        timeoutUnit: 'days',
        conditions: [
          {
            join: 'and',
            conditions: [{ field: 'contact.tags', operator: 'includes', value: 'cliente' }]
          }
        ]
      })
    )
    def = insert(def, { parent: 'w', port: 'met' }, node('yes', 'notify_mac', { title: 'cumplió' }))
    def = insert(
      def,
      { parent: 'w', port: 'timeout' },
      node('no', 'notify_mac', { title: 'venció' })
    )
    await publish(def)
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    expect((await runs())[0].status).toBe('waiting')
    await tag(c.id, 'cliente')
    await engine.runOnce()
    expect(notices).toEqual(['cumplió'])
  })

  it('la espera por condición sale por «tiempo agotado» al vencer', async () => {
    let def = chain(tagTrigger('webinar'))
    def = insert(
      def,
      ROOT_SLOT,
      node('w', 'wait', {
        mode: 'condition',
        timeout: 2,
        timeoutUnit: 'hours',
        conditions: [
          {
            join: 'and',
            conditions: [{ field: 'contact.tags', operator: 'includes', value: 'cliente' }]
          }
        ]
      })
    )
    def = insert(
      def,
      { parent: 'w', port: 'timeout' },
      node('no', 'notify_mac', { title: 'venció' })
    )
    await publish(def)
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    clock.advance(2 * HOUR + 1000)
    await engine.runOnce()
    expect(notices).toEqual(['venció'])
  })

  it('reintenta un paso externo a 1, 5 y 30 minutos y luego falla', async () => {
    await publish(
      chain(tagTrigger('webinar'), node('h', 'webhook', { method: 'POST', url: 'https://x.test' }))
    )
    webhookFails = 10
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    for (const minutes of [1, 5, 30]) {
      expect((await runs())[0].status).toBe('waiting')
      clock.advance(minutes * 60_000)
      await engine.runOnce()
    }
    const [run] = await runs()
    expect(run.status).toBe('failed')
    expect(run.reason).toMatch(/Límite de reintentos/)
    const statuses = (
      await db.getRepository(RunStepModel).find({ order: { startedAt: 'ASC' } })
    ).map((s) => s.status)
    expect(statuses).toEqual(['retrying', 'retrying', 'retrying', 'failed'])
    expect(alerts).toHaveLength(1)
  })

  it('un paso externo que se recupera sigue el camino', async () => {
    await publish(
      chain(
        tagTrigger('webinar'),
        node('h', 'webhook', { method: 'POST', url: 'https://x.test' }),
        node('n', 'notify_mac', { title: 'código {{steps.h.status}}' })
      )
    )
    webhookFails = 1
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    clock.advance(60_000)
    await engine.runOnce()
    expect(notices).toEqual(['código 200'])
  })

  it('A y B se disparan entre sí: el bucle se corta en la misma cadena', async () => {
    await publish(
      chain(
        tagTrigger('a'),
        node('x1', 'remove_tag', { tag: 'a' }),
        node('x2', 'add_tag', { tag: 'b' })
      ),
      'A'
    )
    await publish(
      chain(
        tagTrigger('b'),
        node('y1', 'remove_tag', { tag: 'b' }),
        node('y2', 'add_tag', { tag: 'a' })
      ),
      'B'
    )
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'a')
    for (let i = 0; i < 4; i++) await engine.runOnce()
    const outcomes = (
      await db.getRepository(TriggerLogModel).find({ order: { createdAt: 'ASC' } })
    ).map((l) => l.outcome)
    expect(outcomes.filter((o) => o === 'enrolled')).toHaveLength(2)
    expect(outcomes).toContain('loop_limit')
    expect(await runs()).toHaveLength(2)
  })

  it('una ejecución en espera sigue su versión aunque se publique otra', async () => {
    const def1 = chain(
      tagTrigger('webinar'),
      node('w', 'wait', { mode: 'delay', amount: 1, unit: 'hours' }),
      node('n', 'notify_mac', { title: 'v1' })
    )
    const { id } = await publish(def1)
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    const def2 = {
      ...def1,
      nodes: { ...def1.nodes, n: { ...def1.nodes.n, params: { title: 'v2' } } }
    }
    await publish(def2, 'A', id)
    clock.advance(2 * HOUR)
    await engine.runOnce()
    expect(notices).toEqual(['v1'])
  })

  it('pausada no avanza y al reanudar continúa', async () => {
    const { id } = await publish(
      chain(
        tagTrigger('webinar'),
        node('w', 'wait', { mode: 'delay', amount: 1, unit: 'hours' }),
        node('n', 'notify_mac', { title: 'fin' })
      )
    )
    const c = await contacts.create({ name: 'Ana' })
    await tag(c.id, 'webinar')
    await engine.runOnce()
    await db.getRepository(AutomationModel).update({ id }, { status: 'paused', updatedAt: 'p1' })
    clock.advance(2 * HOUR)
    await engine.runOnce()
    expect(notices).toEqual([])
    await db.getRepository(AutomationModel).update({ id }, { status: 'active', updatedAt: 'p2' })
    await engine.runOnce()
    expect(notices).toEqual(['fin'])
  })

  it('escribir directo en la base, como hace la sincronización, no dispara nada', async () => {
    await publish(chain(tagTrigger('webinar'), node('n', 'notify_mac', { title: 'x' })))
    await transactionGuard(db, async (manager) => {
      await manager.getRepository(ContactModel).save({
        id: 'c9',
        name: 'Remoto',
        role: null,
        email: null,
        phone: null,
        linkedin: null,
        notesMd: '',
        clientId: null,
        projectId: null,
        prospectId: null,
        status: 'none',
        source: null,
        fields: {},
        consentAt: null,
        syncError: null,
        syncedAt: null,
        createdAt: 'x',
        updatedAt: 'x'
      })
    })
    await engine.runOnce()
    expect(await db.getRepository(AutomationEventModel).count()).toBe(0)
    expect(await runs()).toHaveLength(0)
  })
})
