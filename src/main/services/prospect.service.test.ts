import { existsSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { ProspectService } from './prospect.service'
import { isolatedConfig, memoryDb } from '../test/helpers'

describe('ProspectService', () => {
  let db: DataSource
  let prospects: ProspectService

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    prospects = new ProspectService(db)
  })
  afterEach(() => db.destroy())

  it('crea en la primera etapa abierta (seed de la migración)', async () => {
    const p = await prospects.create({ company: 'Acme' })
    const stages = await prospects.listStages()
    expect(p.stageId).toBe(stages.find((s) => s.kind === 'open')!.id)
  })

  it('mover a una etapa ganada crea el cliente y su carpeta', async () => {
    const p = await prospects.create({ company: 'Acme', notesMd: 'nota' })
    const won = (await prospects.listStages()).find((s) => s.kind === 'won')!
    const { prospect, client } = await prospects.move(p.id, won.id)
    expect(client?.name).toBe('Acme')
    expect(prospect.clientId).toBe(client?.id)
    expect(existsSync(client!.folderPath)).toBe(true)

    // Volver a ganarlo no duplica el cliente.
    const again = await prospects.move(p.id, won.id)
    expect(again.client).toBeNull()
  })
})
