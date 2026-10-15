/* eslint-disable @typescript-eslint/no-explicit-any -- respuestas JSON de forma libre en un test */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'net'
import type { Server } from 'http'
import express from 'express'
import type { DataSource } from 'typeorm'
import { AutomationController } from '../main/controllers/automation.controller'
import { automationRoutes } from '../main/routes/automation.routes'
import { errorHandler, notFound } from '../main/middlewares/error.middleware'
import { AutomationService } from '../main/automations/service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

describe('/automations (API que usa Claude)', () => {
  let db: DataSource
  let server: Server
  let base: string

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    const service = new AutomationService({
      db,
      kick: () => undefined,
      invalidate: () => undefined,
      origin: () => 'claude'
    })
    const app = express()
    app.use(express.json())
    app.use('/automations', automationRoutes(new AutomationController(service)))
    app.use(notFound)
    app.use(errorHandler)
    server = app.listen(0, '127.0.0.1')
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/automations`
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
    return { status: res.status, data: res.status === 204 ? null : await res.json() }
  }

  it('crea, guarda borrador, publica, pausa, lista ejecuciones y borra', async () => {
    const created = await call('POST', '', { name: 'Bienvenida', subject: 'contact' })
    expect(created.status).toBe(201)
    const id = created.data.automation.id
    const draft = {
      ...created.data.automation.draft,
      triggers: [{ id: 't', type: 'contact.created', params: {}, conditions: [] }],
      root: 'a',
      nodes: {
        a: { id: 'a', type: 'add_tag', name: 'Tag', params: { tag: 'nuevo' }, next: { next: null } }
      }
    }
    expect((await call('PUT', `/${id}/draft`, { definition: draft })).data.issues).toEqual([])
    expect((await call('POST', `/${id}/publish`)).data.automation.versionNumber).toBe(1)
    expect((await call('POST', `/${id}/status`, { status: 'paused' })).data.automation.status).toBe(
      'paused'
    )
    expect((await call('GET', '')).data.map((a: any) => a.name)).toEqual(['Bienvenida'])
    expect((await call('GET', `/runs?automationId=${id}`)).data).toEqual([])
    expect((await call('GET', `/${id}/versions`)).data).toHaveLength(1)
    expect((await call('POST', `/${id}/test`, { subjectId: null })).data.steps).toHaveLength(1)
    expect((await call('GET', '/nope')).status).toBe(404)
    expect((await call('GET', '/catalog')).data.nodes.length).toBeGreaterThan(20)
    expect((await call('DELETE', `/${id}`)).data).toEqual({ ok: true })
    expect((await call('GET', '')).data).toEqual([])
  })
})
