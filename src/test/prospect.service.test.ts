import { existsSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { ProspectService } from '../main/services/prospect.service'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { StageEventModel, type StageEventRow } from '../main/models/metrics.model'

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

  describe('registro de etapas', () => {
    const events = (): Promise<StageEventRow[]> => db.getRepository(StageEventModel).find()

    it('crear y mover registran un evento por cambio de etapa', async () => {
      const p = await prospects.create({ company: 'Acme', valueUsd: 5000 })
      const stages = await prospects.listStages()
      const second = stages.filter((s) => s.kind === 'open')[1]
      await prospects.move(p.id, second.id)
      await prospects.move(p.id, second.id)
      const list = await events()
      expect(list).toHaveLength(2)
      const moved = list.find((e) => e.toStageId === second.id)
      expect(moved?.fromStageId).toBe(p.stageId)
      expect(moved?.valueUsd).toBe(5000)
    })

    it('ganar fija closedAt y volver a abierta lo borra', async () => {
      const p = await prospects.create({ company: 'Acme' })
      const stages = await prospects.listStages()
      const won = stages.find((s) => s.kind === 'won')!
      const lost = stages.find((s) => s.kind === 'lost')!
      const closed = (await prospects.move(p.id, won.id)).prospect
      expect(closed.closedAt).not.toBeNull()
      const reopened = (await prospects.move(p.id, p.stageId)).prospect
      expect(reopened.closedAt).toBeNull()
      const lostNow = (await prospects.move(p.id, lost.id)).prospect
      expect(lostNow.closedAt).not.toBeNull()
      expect((await events()).filter((e) => e.toKind === 'lost')).toHaveLength(1)
    })

    it('borrar el prospecto borra su registro', async () => {
      const p = await prospects.create({ company: 'Acme' })
      await prospects.remove(p.id)
      expect(await events()).toHaveLength(0)
    })
  })
})
