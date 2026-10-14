import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ClientService } from '../main/services/client.service'
import { setAuthor } from '../main/db/author'

describe('autor de los cambios', () => {
  let db: DataSource
  const authors = async (): Promise<(string | null)[]> =>
    (await db.query(`SELECT by FROM change_log WHERE entity = 'clients' ORDER BY seq`)).map(
      (r: { by: string | null }) => r.by
    )

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
  })
  afterEach(async () => {
    setAuthor(null)
    await db.destroy()
  })

  it('sin sesión los cambios no tienen autor', async () => {
    await new ClientService(db).create({ name: 'Acme' })
    expect(await authors()).toEqual([null])
  })

  it('con sesión cada cambio lleva el usuario, también los que llegan por MCP', async () => {
    setAuthor('user-1')
    const clients = new ClientService(db)
    const c = await clients.create({ name: 'Acme' })
    await clients.update(c.id, { sector: 'Energía' })
    expect(await authors()).toEqual(['user-1', 'user-1'])
  })
})
