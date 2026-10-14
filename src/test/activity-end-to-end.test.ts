import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import type { ActivityEntry } from '../shared/activity'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ClientService } from '../main/services/client.service'
import { TaskService } from '../main/services/task.service'
import { SyncEngine } from '../main/cloud/sync/engine'
import { ActivityFeed } from '../main/cloud/activity/feed'
import { SyncMutations } from '../../services/cloud/src/application/sync'
import { ReadActivity } from '../../services/cloud/src/application/activity'
import type { AuthUser } from '../../services/cloud/src/ports'
import { MemoryStore, ORG, fakeApi, member } from './support/memory-cloud'

const ANA: AuthUser = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'ana@acme.com' }
const BETO: AuthUser = { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'beto@acme.com' }

describe('actividad de punta a punta', () => {
  let store: MemoryStore
  let a: DataSource
  let b: DataSource
  let syncA: SyncEngine
  let feedB: ActivityFeed
  let alerts: ActivityEntry[]

  beforeEach(async () => {
    isolatedConfig()
    store = new MemoryStore()
    const server = new SyncMutations(
      store,
      member,
      { changes: async () => undefined },
      { now: () => Date.now() }
    )
    const activity = new ReadActivity(store, member)
    a = await memoryDb()
    b = await memoryDb()
    syncA = new SyncEngine({
      db: a,
      api: () => fakeApi(server, ANA),
      orgId: ORG,
      deviceId: 'device-a',
      markerFile: '/nonexistent/sync-init.json',
      notify: () => undefined,
      subscribe: () => () => undefined,
      fill: async () => ({}),
      onStatus: () => undefined
    })
    await a.query(`INSERT INTO sync_state (key, value) VALUES ('bootstrapped', '1')`)
    alerts = []
    feedB = new ActivityFeed({
      db: b,
      api: () => fakeApi(server, BETO, undefined, activity),
      orgId: ORG,
      me: () => BETO.userId,
      onNew: (entries) => alerts.push(...entries),
      onState: () => undefined
    })
  })

  afterEach(async () => {
    await syncA.stop()
    await feedB.stop()
    await a.destroy()
    await b.destroy()
  })

  it('lo de antes de unirse no avisa ni cuenta como novedad', async () => {
    await new ClientService(a).create({ name: 'Acme' })
    await syncA.syncNow()
    await feedB.pull()
    expect((await feedB.list()).map((e) => e.verb)).toEqual(['created'])
    expect(alerts).toEqual([])
    expect((await feedB.state()).unseen).toBe(0)
  })

  it('varias ediciones seguidas son una sola entrada con su cuenta', async () => {
    const clients = new ClientService(a)
    const c = await clients.create({ name: 'Acme' })
    await syncA.syncNow()
    await feedB.pull()
    for (const sector of ['Uno', 'Dos', 'Tres']) {
      await clients.update(c.id, { sector })
      await syncA.syncNow()
    }
    await feedB.pull()
    const updates = (await feedB.list({ verb: 'updated' })).filter((e) => e.entityId === c.id)
    expect(updates).toHaveLength(1)
    expect(updates[0].count).toBe(3)
    expect((await feedB.state()).unseen).toBe(1)
    expect((await feedB.markSeen()).unseen).toBe(0)
  })

  it('asignar una tarea a Beto le llega como novedad para avisar', async () => {
    await feedB.pull()
    const tasks = new TaskService(a)
    const t = await tasks.add('2026-10-14', 'Enviar propuesta')
    await tasks.update(t.id, { assignee: BETO.userId })
    await syncA.syncNow()
    await feedB.pull()
    const assigned = alerts.find((e) => e.verb === 'assigned')
    expect(assigned).toMatchObject({
      entity: 'tasks',
      entityId: t.id,
      targetId: BETO.userId,
      actorId: ANA.userId,
      title: 'Enviar propuesta'
    })
    expect((await feedB.list({ entity: 'tasks', entityId: t.id })).length).toBeGreaterThan(0)
  })

  it('la siembra inicial no llena la actividad', async () => {
    const server = new SyncMutations(
      store,
      member,
      { changes: async () => undefined },
      { now: () => Date.now() }
    )
    await server.push(ANA, {
      orgId: ORG,
      deviceId: 'device-a',
      quiet: true,
      mutations: [
        {
          mutationId: 'seed-0000001',
          entity: 'clients',
          id: 'c-seed',
          op: 'upsert',
          fields: { name: 'Viejo' },
          rev: `${String(Date.now()).padStart(15, '0')}:0000:device-a`
        }
      ]
    })
    expect(store.activityLog).toEqual([])
  })
})
