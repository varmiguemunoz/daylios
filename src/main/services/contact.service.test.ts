import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { ContactService } from './contact.service'
import { ProspectService } from './prospect.service'
import { TagService } from './tag.service'
import { OutboxModel, RuleModel } from '../models/marketing.model'
import { isolatedConfig, memoryDb } from '../test/helpers'
import type { Rule } from '@shared/marketing'

describe('ContactService (marketing)', () => {
  let db: DataSource
  let contacts: ContactService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    contacts = new ContactService(db)
  })
  afterEach(() => db.destroy())

  const outbox = (): Promise<{ kind: string; payload: Record<string, unknown> }[]> =>
    db.getRepository(OutboxModel).find({ order: { createdAt: 'ASC' } })

  it('normaliza el email y no permite repetirlo', async () => {
    const a = await contacts.create({ email: '  Ana@Example.COM ' })
    expect(a.email).toBe('ana@example.com')
    expect(a.name).toBeNull()
    expect(a.status).toBe('none')
    await expect(contacts.create({ email: 'ana@example.com' })).rejects.toThrow(/Ya existe/)
    await expect(contacts.create({ email: 'no-es-email' })).rejects.toThrow(/no es un email/)
    await expect(contacts.create({})).rejects.toThrow(/nombre o un email/)
  })

  it('suscribir exige email, guarda consentimiento y encola sync + lead.created', async () => {
    const sinEmail = await contacts.create({ name: 'Sin email' })
    await expect(contacts.subscribe(sinEmail.id)).rejects.toThrow(/necesita un email/)

    const c = await contacts.create({ name: 'Ana', email: 'ana@example.com' })
    const s = await contacts.subscribe(c.id)
    expect(s.status).toBe('subscribed')
    expect(s.source).toBe('manual')
    expect(s.consentAt).not.toBeNull()
    const jobs = await outbox()
    expect(jobs.map((j) => j.kind)).toEqual(['contact', 'event'])
    expect(jobs[1].payload.event).toBe('lead.created')

    // Darse de baja y volver a suscribir no repite lead.created.
    await contacts.unsubscribe(c.id)
    await contacts.subscribe(c.id)
    const events = (await outbox()).filter((j) => j.kind === 'event')
    expect(events).toHaveLength(1)
  })

  it('tags idempotentes, con línea de tiempo y eventos solo si está suscrito', async () => {
    const c = await contacts.create({ email: 'ana@example.com' })
    await contacts.tag(c.id, { add: ['Webinar Octubre', 'webinar-octubre'] })
    let detail = await contacts.get(c.id)
    expect(detail.tags).toEqual([{ slug: 'webinar-octubre', name: 'Webinar Octubre' }])
    expect(await outbox()).toHaveLength(0) // status none: nada hacia Resend

    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { add: ['vip'] })
    await contacts.tag(c.id, { add: ['vip'] })
    const events = (await outbox()).filter((j) => j.kind === 'event').map((j) => j.payload.event)
    expect(events).toEqual(['lead.created', 'tag.vip'])

    await contacts.tag(c.id, { remove: ['webinar-octubre'] })
    detail = await contacts.get(c.id)
    expect(detail.tags.map((t) => t.slug)).toEqual(['vip'])
    expect(detail.events.map((e) => e.type)).toContain('tag_removed')

    const tags = await new TagService(db).list()
    expect(tags.find((t) => t.slug === 'vip')).toMatchObject({ contacts: 1, subscribed: 1 })
  })

  it('filtra por tag, estado y texto, con paginación', async () => {
    for (let i = 0; i < 5; i++) await contacts.create({ name: `Lead ${i}`, email: `l${i}@x.com` })
    const muñoz = await contacts.create({ name: 'Ali Muñoz', email: 'ali@x.com' })
    await contacts.tag(muñoz.id, { add: ['vip'] })
    await contacts.subscribe(muñoz.id)

    expect((await contacts.list({ tag: 'vip' })).contacts.map((c) => c.id)).toEqual([muñoz.id])
    expect((await contacts.list({ status: 'subscribed' })).total).toBe(1)
    expect((await contacts.list({ query: 'munoz' })).contacts[0].id).toBe(muñoz.id)
    const page2 = await contacts.list({ pageSize: 4, page: 2 })
    expect(page2).toMatchObject({ page: 2, totalPages: 2, total: 6 })
    expect(page2.contacts).toHaveLength(2)
  })

  it('pasar a pipeline crea el prospecto y lo enlaza una sola vez', async () => {
    const c = await contacts.create({
      name: 'Ana',
      email: 'ana@x.com',
      fields: { company: 'Acme' }
    })
    const { prospect, contact } = await contacts.promote(c.id)
    expect(prospect.company).toBe('Acme')
    expect(contact.prospectId).toBe(prospect.id)
    expect((await new ProspectService(db).get(prospect.id)).contacts.map((x) => x.id)).toEqual([
      c.id
    ])
    await expect(contacts.promote(c.id)).rejects.toThrow(/ya está en el pipeline/)
  })

  it('las reglas se aplican al añadir tags a mano (encadenadas y con promoción)', async () => {
    const stamp = new Date().toISOString()
    const rule = (
      id: string,
      triggerTag: string,
      actions: Rule['actions'],
      position = 0
    ): Rule => ({
      id,
      name: id,
      position,
      active: true,
      triggerTag,
      actions,
      createdAt: stamp,
      updatedAt: stamp
    })
    await db.getRepository(RuleModel).save([
      rule('r1', 'webinar', [{ type: 'add_tag', tag: 'nurture' }]),
      rule('r2', 'nurture', [
        { type: 'fire_event', event: 'nurture.start' },
        { type: 'promote', stage: '' }
      ])
    ])
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.subscribe(c.id)
    await contacts.tag(c.id, { add: ['webinar'] })

    const detail = await contacts.get(c.id)
    expect(detail.tags.map((t) => t.slug).sort()).toEqual(['nurture', 'webinar'])
    expect(detail.prospectId).not.toBeNull()
    const events = (await outbox()).filter((j) => j.kind === 'event').map((j) => j.payload.event)
    expect(events).toEqual(['lead.created', 'tag.webinar', 'tag.nurture', 'nurture.start'])
  })

  it('cambiar el email de un suscrito encola la baja del email anterior', async () => {
    const c = await contacts.create({ email: 'old@x.com' })
    await contacts.subscribe(c.id)
    await contacts.update(c.id, { email: 'new@x.com' })
    const job = (await outbox()).find((j) => j.kind === 'contact')!
    expect(job.payload.previousEmails).toEqual(['old@x.com'])
    await expect(contacts.update(c.id, { email: '' })).rejects.toThrow(/necesita un email/)
  })
})
