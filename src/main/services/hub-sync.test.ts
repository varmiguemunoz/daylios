import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import type { HubConfig, HubHealth, HubItem, HubLeadItem } from '@shared/hub'
import { HubSync } from './hub-sync'
import { SourceService } from './source.service'
import { ContactService } from './contact.service'
import type { HubClient } from './hub.client'
import { LeadSourceModel, OutboxModel, TagModel } from '../models/marketing.model'
import { isolatedConfig, memoryDb } from '../test/helpers'

/** Worker falso: guarda la config empujada y sirve una cola. */
class FakeHub implements HubClient {
  config: HubConfig | null = null
  queue: HubItem[] = []
  acked: string[] = []
  down = false
  async health(): Promise<HubHealth> {
    return {
      ok: true,
      sources: 0,
      rules: 0,
      queued: this.queue.length,
      resend: true,
      webhooks: true
    }
  }
  async inbox(limit = 100): Promise<HubItem[]> {
    if (this.down) throw new Error('caído')
    return this.queue.slice(0, limit)
  }
  async ack(ids: string[]): Promise<void> {
    this.acked.push(...ids)
    this.queue = this.queue.filter((i) => !ids.includes(i.id))
  }
  async putConfig(c: HubConfig): Promise<HubConfig> {
    if (this.down) throw new Error('caído')
    this.config = { ...c, segments: { ...c.segments, 'origen-web': 'seg_web' } }
    return this.config
  }
}

const leadItem = (id: string, patch: Partial<HubLeadItem> = {}): HubLeadItem => ({
  id,
  kind: 'lead',
  receivedAt: '2026-10-02T10:00:00.000Z',
  source: 'web',
  lead: { email: 'ana@x.com', name: 'Ana', tags: [], fields: { company: 'Acme' } },
  added: ['origen-web'],
  removed: [],
  events: [],
  promote: null,
  resend: {
    ok: true,
    error: null,
    created: true,
    unsubscribed: false,
    segments: { 'origen-web': 'seg_web' }
  },
  ...patch
})

describe('HubSync', () => {
  let db: DataSource
  let hub: FakeHub
  let sync: HubSync
  let contacts: ContactService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    hub = new FakeHub()
    sync = new HubSync(db, () => hub)
    contacts = new ContactService(db)
  })
  afterEach(() => db.destroy())

  it('empuja fuentes con el hash del secreto (nunca el secreto) solo cuando cambian', async () => {
    const source = await new SourceService(db).create({ name: 'Web', defaultTags: ['Newsletter'] })
    await sync.pull()
    expect(hub.config!.sources).toEqual([
      {
        slug: 'web',
        name: 'Web',
        defaultTags: ['newsletter'],
        secretHash: createHash('sha256').update(source.secret).digest('hex')
      }
    ])
    expect(JSON.stringify(hub.config)).not.toContain(source.secret)

    hub.config = null
    await sync.pull()
    expect(hub.config).toBeNull() // sin cambios, no se vuelve a empujar
  })

  it('aplica un lead nuevo: suscrito, con consentimiento, tags, segment y conteo de la fuente', async () => {
    await new SourceService(db).create({ name: 'Web' })
    hub.queue = [leadItem('i1')]
    expect(await sync.pull()).toBe(1)
    expect(hub.acked).toEqual(['i1'])

    const { contacts: list } = await contacts.list({})
    expect(list).toHaveLength(1)
    const c = await contacts.get(list[0].id)
    expect(c).toMatchObject({
      email: 'ana@x.com',
      name: 'Ana',
      status: 'subscribed',
      source: 'web',
      consentAt: '2026-10-02T10:00:00.000Z',
      fields: { company: 'Acme' }
    })
    expect(c.tags.map((t) => t.slug)).toEqual(['origen-web'])
    expect(c.events.map((e) => e.type)).toEqual(expect.arrayContaining(['lead', 'tag_added']))
    expect(
      (await db.getRepository(TagModel).findOneByOrFail({ slug: 'origen-web' })).segmentId
    ).toBe('seg_web')
    expect(
      (await db.getRepository(LeadSourceModel).findOneByOrFail({ slug: 'web' })).receivedCount
    ).toBe(1)

    // Resend ya hecho por el Worker: solo una reconciliación, sin eventos.
    const jobs = await db.getRepository(OutboxModel).find()
    expect(jobs.map((j) => j.kind)).toEqual(['contact'])
  })

  it('reprocesar un item ya aplicado (ack perdido) no duplica nada', async () => {
    hub.queue = [leadItem('i1')]
    await sync.apply(hub.queue[0])
    await sync.pull()
    expect(hub.acked).toEqual(['i1'])
    const c = await contacts.get((await contacts.list({})).contacts[0].id)
    expect(c.events.filter((e) => e.type === 'lead')).toHaveLength(1)
  })

  it('si el Worker no pudo con Resend, la app encola sync y eventos (lead.created incluido)', async () => {
    hub.queue = [
      leadItem('i1', {
        added: ['origen-web', 'webinar'],
        events: ['custom.event'],
        resend: { ok: false, error: 'x', created: false, unsubscribed: false, segments: {} }
      })
    ]
    await sync.pull()
    const events = (await db.getRepository(OutboxModel).find({ order: { createdAt: 'ASC' } }))
      .filter((j) => j.kind === 'event')
      .map((j) => j.payload.event)
    expect(events).toEqual(['tag.origen-web', 'tag.webinar', 'custom.event', 'lead.created'])
  })

  it('un contacto de trabajo que deja su email pasa a suscrito; una baja se respeta', async () => {
    const work = await contacts.create({ name: 'Bea', email: 'bea@x.com' })
    const gone = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(gone.id)
    await contacts.unsubscribe(gone.id)

    hub.queue = [
      leadItem('i1', { lead: { email: 'bea@x.com', name: null, tags: [], fields: {} } }),
      leadItem('i2')
    ]
    await sync.pull()
    expect((await contacts.get(work.id)).status).toBe('subscribed')
    expect((await contacts.get(work.id)).name).toBe('Bea')
    expect((await contacts.get(gone.id)).status).toBe('unsubscribed')
  })

  it('promoción pedida por regla (etapa inexistente → primera abierta)', async () => {
    hub.queue = [leadItem('i1', { promote: 'Etapa que no existe' })]
    await sync.pull()
    const c = await contacts.get((await contacts.list({})).contacts[0].id)
    expect(c.prospectId).not.toBeNull()
  })

  it('aplica bajas, rebotes y quejas; ignora emails desconocidos', async () => {
    const a = await contacts.create({ email: 'a@x.com' })
    const b = await contacts.create({ email: 'b@x.com' })
    await contacts.subscribe(a.id)
    await contacts.subscribe(b.id)
    const status = (
      id: string,
      email: string,
      s: 'unsubscribed' | 'bounced' | 'complained'
    ): HubItem => ({
      id,
      kind: 'status',
      receivedAt: '2026-10-02T10:00:00.000Z',
      email,
      status: s,
      event: 'test'
    })
    hub.queue = [
      status('s1', 'a@x.com', 'unsubscribed'),
      status('s2', 'b@x.com', 'bounced'),
      status('s3', 'z@x.com', 'complained')
    ]
    hub.queue.push(status('s4', 'b@x.com', 'unsubscribed')) // no rebaja un rebote
    await sync.pull()
    expect((await contacts.get(a.id)).status).toBe('unsubscribed')
    expect((await contacts.get(b.id)).status).toBe('bounced')
    expect(hub.acked).toHaveLength(4)
  })

  it('hub caído: lanza (MarketingSync lo registra) y no confirma nada', async () => {
    hub.down = true
    await expect(sync.pull()).rejects.toThrow(/caído/)
    expect(hub.acked).toHaveLength(0)
  })
})
