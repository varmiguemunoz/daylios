/* eslint-disable @typescript-eslint/no-explicit-any -- respuestas JSON de forma libre en un test */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'net'
import type { Server } from 'http'
import express from 'express'
import type { DataSource } from 'typeorm'
import { createMarketing } from '../marketing'
import { MarketingController } from '../controllers/marketing.controller'
import { marketingRoutes } from './marketing.routes'
import { errorHandler, notFound } from '../middlewares/error.middleware'
import { ContactService } from '../services/contact.service'
import { FakeResend } from '../test/fake-resend'
import { isolatedConfig, memoryDb } from '../test/helpers'
import { saveSettings } from '../config'

/** Lo que llama el MCP: rutas `/marketing/*` sobre los servicios reales y un Resend falso. */
describe('/marketing (API que usa Claude)', () => {
  let db: DataSource
  let server: Server
  let base: string
  let resend: FakeResend

  beforeEach(async () => {
    isolatedConfig()
    saveSettings({ fromEmail: 'hola@ejemplo.com', ownerEmail: 'yo@ejemplo.com' })
    db = await memoryDb()
    resend = new FakeResend()
    const marketing = createMarketing(
      db,
      () => resend,
      () => null,
      () => {}
    )
    const app = express()
    app.use(express.json({ limit: '512kb' }))
    app.use('/marketing', marketingRoutes(new MarketingController(marketing)))
    app.use(notFound)
    app.use(errorHandler)
    server = app.listen(0, '127.0.0.1')
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/marketing`

    const contacts = new ContactService(db)
    const c = await contacts.create({ email: 'ana@x.com' })
    await contacts.tag(c.id, { add: ['clientes'] })
    await contacts.subscribe(c.id)
  })
  afterEach(async () => {
    await new Promise((r) => server.close(r))
    await db.destroy()
  })

  const call = async (
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: any }> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return { status: res.status, data: await res.json() }
  }

  it('flujo de Claude: contexto → enviar newsletter → segundo envío rechazado → historial', async () => {
    const ctx = await call('GET', '/newsletters/context')
    expect(ctx.data).toMatchObject({
      paused: false,
      sentToday: false,
      tags: [{ slug: 'clientes', subscribed: 1 }]
    })

    const sent = await call('POST', '/newsletters', {
      tag: 'clientes',
      subject: 'Hola',
      html: '<p>Hola</p>'
    })
    expect(sent.status).toBe(201)
    expect(sent.data.status).toBe('sent')

    const again = await call('POST', '/newsletters', {
      tag: 'clientes',
      subject: 'Otra',
      html: '<p>x</p>'
    })
    expect(again.status).toBe(400)
    expect(again.data.error).toMatch(/uno por día/)

    const list = await call('GET', '/newsletters')
    expect(list.data).toHaveLength(1)
    expect(list.data[0].html).toBeUndefined()
  })

  it('reglas, secuencias, fuentes (sin secretos) y tags', async () => {
    const rule = await call('POST', '/rules', {
      name: 'Bienvenida',
      triggerTag: 'webinar',
      actions: [{ type: 'fire_event', event: 'webinar.welcome' }]
    })
    expect(rule.status).toBe(201)
    expect((await call('GET', '/rules')).data).toHaveLength(1)
    expect((await call('POST', '/rules', { name: 'x', triggerTag: 'a', actions: [] })).status).toBe(
      400
    )

    const seq = await call('POST', '/sequences', {
      name: 'Webinar',
      event: 'webinar.welcome',
      emails: [{ subject: 'Gracias', html: '<p>Hola</p>' }]
    })
    expect(seq.data).toMatchObject({ status: 'disabled', emails: 1, event: 'webinar.welcome' })
    expect(
      (await call('POST', `/sequences/${seq.data.id}/status`, { enabled: true })).data.status
    ).toBe('enabled')

    const marketing = createMarketing(
      db,
      () => resend,
      () => null,
      () => {}
    )
    await marketing.sources.create({ name: 'Web' })
    const sources = await call('GET', '/sources')
    expect(sources.data[0].slug).toBe('web')
    expect(sources.data[0].secret).toBeUndefined()

    expect((await call('GET', '/tags')).data.map((t: { slug: string }) => t.slug)).toContain(
      'clientes'
    )
    expect((await call('GET', '/status')).data).toMatchObject({
      resendConfigured: true,
      hubConfigured: false
    })
  })
})
