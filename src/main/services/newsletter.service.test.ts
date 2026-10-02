import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { NewsletterService } from './newsletter.service'
import { ContactService } from './contact.service'
import { TagService } from './tag.service'
import { MarketingSync } from './marketing-sync'
import { NewsletterModel } from '../models/marketing.model'
import { FakeResend } from '../test/fake-resend'
import { isolatedConfig, memoryDb } from '../test/helpers'
import { saveSettings } from '../config'

describe('NewsletterService', () => {
  let db: DataSource
  let resend: FakeResend
  let newsletters: NewsletterService

  beforeEach(async () => {
    isolatedConfig()
    saveSettings({ fromEmail: 'hola@ejemplo.com', ownerEmail: 'yo@ejemplo.com' })
    db = await memoryDb()
    resend = new FakeResend()
    const sync = new MarketingSync(db, () => resend)
    newsletters = new NewsletterService(
      db,
      () => resend,
      new TagService(db),
      () => sync.tick()
    )

    const contacts = new ContactService(db)
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.tag(c.id, { add: ['clientes-perdidos'] })
    await contacts.subscribe(c.id)
    await contacts.create({ email: 'b@x.com' }).then((b) => contacts.tag(b.id, { add: ['vacio'] }))
  })
  afterEach(() => db.destroy())

  const input = { tag: 'clientes-perdidos', subject: 'Tres ideas', html: '<p>Hola</p>' }

  it('envía copia al dueño, luego el broadcast al segment del tag, con pie de baja', async () => {
    const n = await newsletters.send(input)
    expect(n.status).toBe('sent')
    expect(resend.emails).toHaveLength(1)
    expect(resend.emails[0]).toMatchObject({ to: 'yo@ejemplo.com', subject: '[Copia] Tres ideas' })
    expect(resend.emails[0].html).not.toContain('RESEND_UNSUBSCRIBE_URL')

    const [b] = resend.broadcasts
    expect(resend.segments.get(b.segmentId)).toBe('tag:clientes-perdidos')
    expect(b.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
    // El segment tiene al suscrito (la cola se vació antes).
    expect([...resend.contacts.get('ana@x.com')!.segments]).toContain(b.segmentId)
    expect((await newsletters.context()).sentToday).toBe(true)
  })

  it('máximo uno por día; un fallo libera el día', async () => {
    await newsletters.send(input)
    await expect(newsletters.send(input)).rejects.toThrow(/Máximo uno por día/)

    await db.getRepository(NewsletterModel).clear()
    // Falla la copia al dueño: no se envía a la lista y queda `failed`.
    const original = resend.sendEmail.bind(resend)
    resend.sendEmail = async () => {
      throw new Error('copia rechazada')
    }
    await expect(newsletters.send(input)).rejects.toThrow(/No se envió: copia rechazada/)
    expect(resend.broadcasts).toHaveLength(1) // solo el primero
    const [failed] = await newsletters.list()
    expect(failed).toMatchObject({ status: 'failed', error: 'copia rechazada' })

    resend.sendEmail = original
    expect((await newsletters.send(input)).status).toBe('sent')
  })

  it('no envía si hay suscritos del tag sin sincronizar (se quedarían fuera)', async () => {
    resend.failNext() // la cola falla: el contacto no llega al segment
    await expect(newsletters.send(input)).rejects.toThrow(/sin recibirlo/)
    expect(resend.broadcasts).toHaveLength(0)
  })

  it('pausa, tag inexistente o sin suscritos: no envía nada', async () => {
    newsletters.setPaused(true)
    await expect(newsletters.send(input)).rejects.toThrow(/en pausa/)
    newsletters.setPaused(false)
    await expect(newsletters.send({ ...input, tag: 'no-existe' })).rejects.toThrow(
      /No existe el tag/
    )
    await expect(newsletters.send({ ...input, tag: 'vacio' })).rejects.toThrow(/no tiene suscritos/)
    expect(resend.broadcasts).toHaveLength(0)
    expect(await newsletters.list()).toHaveLength(0)
  })

  it('programado queda como scheduled; el contexto lista tags con suscritos', async () => {
    const n = await newsletters.send({ ...input, scheduledAt: 'tomorrow at 9am' })
    expect(n.status).toBe('scheduled')
    expect(resend.broadcasts[0].scheduledAt).toBe('tomorrow at 9am')
    const ctx = await newsletters.context()
    expect(ctx.tags).toEqual([
      { slug: 'clientes-perdidos', name: 'clientes-perdidos', subscribed: 1 }
    ])
    expect(ctx.recent[0]).toMatchObject({ subject: 'Tres ideas', status: 'scheduled' })
  })
})
