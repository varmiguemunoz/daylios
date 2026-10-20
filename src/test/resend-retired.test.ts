import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import type { DataSource } from 'typeorm'
import { ACTIVE_NODES, nodeIssues, nodeSpec } from '@shared/automations'
import { MarketingSync } from '../main/services/marketing-sync'
import { OutboxModel } from '../main/models/marketing.model'
import { FakeResend } from '../main/test/fake-resend'
import { routerFor } from '../main/test/email-delivery'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

describe('secuencias de Resend retiradas', () => {
  let db: DataSource

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
  })
  afterEach(() => db.destroy())

  it('descarta trabajos de evento viejos sin llamar a Resend', async () => {
    const resend = new FakeResend()
    const stamp = new Date(0).toISOString()
    await db.getRepository(OutboxModel).insert({
      id: randomUUID(),
      kind: 'event',
      ref: randomUUID(),
      payload: { event: 'tag.vip' },
      attempts: 0,
      lastError: null,
      nextAt: stamp,
      createdAt: stamp
    })
    await new MarketingSync(db, routerFor(resend)).tick()
    expect(await db.getRepository(OutboxModel).count()).toBe(0)
    expect(resend.events).toEqual([])
  })

  it('el nodo start_sequence ya no se ofrece y no se puede publicar', () => {
    expect(ACTIVE_NODES.map((n) => n.type)).not.toContain('start_sequence')
    const spec = nodeSpec('start_sequence')!
    expect(nodeIssues(spec, { event: 'tag.vip' })[0]).toMatch(/se retiraron/)
  })
})
