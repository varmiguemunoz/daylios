import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { RuleService } from './rule.service'
import { ContactService } from './contact.service'
import { ProspectService } from './prospect.service'
import { TagModel } from '../models/marketing.model'
import { isolatedConfig, memoryDb } from '../test/helpers'

describe('RuleService', () => {
  let db: DataSource
  let rules: RuleService
  let changes: number

  beforeEach(async () => {
    isolatedConfig()
    db = await memoryDb()
    changes = 0
    rules = new RuleService(db, () => changes++)
  })
  afterEach(() => db.destroy())

  it('valida, normaliza tags y guarda la etapa por id', async () => {
    const discovery = (await new ProspectService(db).listStages()).find(
      (s) => s.name === 'Discovery'
    )!
    const rule = await rules.create({
      name: 'Webinar',
      triggerTag: 'Webinar Octubre',
      actions: [
        { type: 'add_tag', tag: 'Nurture' },
        { type: 'fire_event', event: 'webinar.followup' },
        { type: 'promote', stage: 'discovery' }
      ]
    })
    expect(rule.triggerTag).toBe('webinar-octubre')
    expect(rule.actions).toEqual([
      { type: 'add_tag', tag: 'nurture' },
      { type: 'fire_event', event: 'webinar.followup' },
      { type: 'promote', stage: discovery.id }
    ])
    // Los tags quedan creados para los selectores.
    expect((await db.getRepository(TagModel).find()).map((t) => t.slug).sort()).toEqual([
      'nurture',
      'webinar-octubre'
    ])
    expect(changes).toBe(1)

    await expect(rules.create({ name: 'x', triggerTag: 'a', actions: [] })).rejects.toThrow(
      /al menos una acción/
    )
    await expect(
      rules.create({
        name: 'x',
        triggerTag: 'a',
        actions: [{ type: 'fire_event', event: 'no válido' }]
      })
    ).rejects.toThrow(/El evento/)
    await expect(
      rules.create({
        name: 'x',
        triggerTag: 'a',
        actions: [{ type: 'promote', stage: 'No existe' }]
      })
    ).rejects.toThrow()
  })

  it('ordena, pausa y la app las aplica al etiquetar', async () => {
    const a = await rules.create({
      name: 'A',
      triggerTag: 'vip',
      actions: [{ type: 'add_tag', tag: 'prioridad' }]
    })
    const b = await rules.create({
      name: 'B',
      triggerTag: 'x',
      actions: [{ type: 'add_tag', tag: 'y' }]
    })
    expect((await rules.reorder([b.id, a.id])).map((r) => r.name)).toEqual(['B', 'A'])
    await expect(rules.reorder([a.id])).rejects.toThrow(/todas las reglas/)

    const contacts = new ContactService(db)
    const c = await contacts.create({ email: 'a@x.com' })
    await contacts.tag(c.id, { add: ['vip'] })
    expect((await contacts.get(c.id)).tags.map((t) => t.slug).sort()).toEqual(['prioridad', 'vip'])

    await rules.update(b.id, { active: false })
    await contacts.tag(c.id, { add: ['x'] })
    expect((await contacts.get(c.id)).tags.map((t) => t.slug)).not.toContain('y')
  })
})
