import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { In, type DataSource } from 'typeorm'
import { ContactService } from './contact.service'
import { MarketingSync } from './marketing-sync'
import { OutboxModel, TagModel } from '../models/marketing.model'
import { ContactModel } from '../models/contact.model'
import { FakeResend } from '../test/fake-resend'
import { isolatedConfig, memoryDb } from '../test/helpers'

describe('MarketingSync (outbox → Resend)', () => {
  let db: DataSource
  let contacts: ContactService
  let resend: FakeResend
  let sync: MarketingSync

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    contacts = new ContactService(db)
    resend = new FakeResend()
    sync = new MarketingSync(db, () => resend)
  })
  afterEach(() => db.destroy())

  const jobs = (): Promise<number> => db.getRepository(OutboxModel).count()

  it('crea el contacto con un segment por tag y luego dispara los eventos', async () => {
    const c = await contacts.create({ name: 'Ana López', email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { add: ['webinar'] })
    await sync.tick()

    const remote = resend.contacts.get('ana@x.com')!
    expect(remote.unsubscribed).toBe(false)
    expect(remote.firstName).toBe('Ana')
    const tag = await db.getRepository(TagModel).findOneByOrFail({ slug: 'webinar' })
    expect(resend.segments.get(tag.segmentId!)).toBe('tag:webinar')
    expect([...remote.segments]).toEqual([tag.segmentId])
    expect(resend.events.map((e) => e.event)).toEqual(['lead.created', 'tag.webinar'])
    expect(await jobs()).toBe(0)
    expect(
      (await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })).syncedAt
    ).not.toBeNull()
  })

  it('quitar un tag lo saca del segment; darse de baja lo marca en Resend', async () => {
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { add: ['a', 'b'] })
    await sync.tick()
    await contacts.tag(c.id, { remove: ['a'] })
    await contacts.unsubscribe(c.id)
    await sync.tick()
    const remote = resend.contacts.get('ana@x.com')!
    expect([...remote.segments].map((id) => resend.segments.get(id))).toEqual(['tag:b'])
    expect(remote.unsubscribed).toBe(true)
  })

  it('un fallo guarda el error, reprograma y se recupera en el siguiente intento', async () => {
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    resend.failNext()
    await sync.tick()

    const failed = await db.getRepository(OutboxModel).findOneByOrFail({ kind: 'contact' })
    expect(failed.attempts).toBe(1)
    expect(failed.lastError).toMatch(/Fallo simulado/)
    expect((await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })).syncError).toMatch(
      /Fallo/
    )
    expect(resend.events).toHaveLength(0) // el evento espera al contacto
    expect((await sync.status()).failing).toBe(1)

    // Vence el reintento.
    await db
      .getRepository(OutboxModel)
      .update({ kind: In(['contact', 'event']) }, { nextAt: new Date(0).toISOString() })
    await sync.tick()
    expect(await jobs()).toBe(0)
    expect(resend.events.map((e) => e.event)).toEqual(['lead.created'])
    expect(
      (await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })).syncError
    ).toBeNull()
  })

  it('no reactiva a quien se dio de baja en Resend, salvo que lo resuscribas a mano', async () => {
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    await sync.tick()
    resend.contacts.get('ana@x.com')!.unsubscribed = true // clic en «Darse de baja»

    await contacts.update(c.id, { name: 'Ana' })
    await sync.tick()
    const local = await db.getRepository(ContactModel).findOneByOrFail({ id: c.id })
    expect(local.status).toBe('unsubscribed')
    expect(resend.contacts.get('ana@x.com')!.unsubscribed).toBe(true)

    await contacts.subscribe(c.id)
    await sync.tick()
    expect(resend.contacts.get('ana@x.com')!.unsubscribed).toBe(false)
  })

  it('cambiar el email da de baja el anterior en Resend', async () => {
    const c = await contacts.create({ email: 'old@x.com' })
    await contacts.subscribe(c.id)
    await sync.tick()
    await contacts.update(c.id, { email: 'new@x.com' })
    await sync.tick()
    expect(resend.contacts.get('old@x.com')!.unsubscribed).toBe(true)
    expect(resend.contacts.get('new@x.com')!.unsubscribed).toBe(false)
  })

  it('sin API key no hace nada (la cola espera)', async () => {
    const offline = new MarketingSync(db, () => null)
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    await offline.tick()
    expect(await jobs()).toBe(2)
    expect((await offline.status()).resendConfigured).toBe(false)
  })
})
