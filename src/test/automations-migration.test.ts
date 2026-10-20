import { describe, expect, it } from 'vitest'
import { validateDefinition } from '@shared/automations'
import {
  MigrateRulesToAutomations1729700000000,
  ruleDefinition,
  stableId
} from '../main/db/migrations/MigrateRulesToAutomations'
import { AutomationModel, AutomationVersionModel } from '../main/models/automation.model'
import { isolatedConfig, memoryDb } from '../main/test/helpers'

const stages = [
  { id: 's1', name: 'Lead', pipeline_id: 'p1' },
  { id: 's2', name: 'Discovery', pipeline_id: 'p1' }
]

const rule = (actions: unknown[]): Parameters<typeof ruleDefinition>[0] => ({
  id: 'r1',
  name: 'Webinar',
  active: 1,
  trigger_tag: 'webinar',
  actions: JSON.stringify(actions),
  created_at: ''
})

describe('migración de reglas', () => {
  it('convierte cada acción en un paso en cadena con su trigger de tag', () => {
    const def = ruleDefinition(
      rule([
        { type: 'add_tag', tag: 'nurture' },
        { type: 'remove_tag', tag: 'newsletter' },
        { type: 'fire_event', event: 'nurture.start' },
        { type: 'promote', stage: 'discovery' }
      ]),
      stages
    )
    expect(def.subject).toBe('contact')
    expect(def.triggers).toEqual([
      { id: 't1', type: 'contact.tag_added', params: { tag: 'webinar' }, conditions: [] }
    ])
    expect(def.root).toBe('n1')
    expect(
      ['n1', 'n2', 'n3', 'n4'].map((id) => [
        def.nodes[id].type,
        def.nodes[id].params,
        def.nodes[id].next
      ])
    ).toEqual([
      ['add_tag', { tag: 'nurture' }, { next: 'n2' }],
      ['remove_tag', { tag: 'newsletter' }, { next: 'n3' }],
      ['start_sequence', { event: 'nurture.start' }, { next: 'n4' }],
      ['create_prospect', { pipeline: 'p1', stage: 's2' }, { next: null }]
    ])
    expect(validateDefinition(def).map((i) => i.path)).toEqual(['nodes.n3'])
    expect(JSON.stringify(validateDefinition(def))).toMatch(/se retiraron/)
  })

  it('promote sin etapa va a la primera y los ids son estables entre equipos', () => {
    const def = ruleDefinition(rule([{ type: 'promote', stage: '' }]), stages)
    expect(def.nodes.n1.params).toEqual({ pipeline: 'p1', stage: 's1' })
    expect(stableId('x')).toBe(stableId('x'))
    expect(stableId('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('migra las reglas vivas de la base, respeta pausadas y borra la tabla', async () => {
    isolatedConfig()
    const db = await memoryDb()
    try {
      expect(await db.createQueryRunner().hasTable('rules')).toBe(false)
      await db.query(`CREATE TABLE rules (id TEXT PRIMARY KEY, name TEXT, position INTEGER, active BOOLEAN,
        trigger_tag TEXT, actions TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT NULL)`)
      const actions = JSON.stringify([{ type: 'add_tag', tag: 'nurture' }])
      await db.query(
        `INSERT INTO rules VALUES ('a', 'Activa', 0, 1, 'webinar', ?, '2026-01-01', '', NULL)`,
        [actions]
      )
      await db.query(
        `INSERT INTO rules VALUES ('b', 'Pausada', 1, 0, 'promo', ?, '2026-01-01', '', NULL)`,
        [actions]
      )
      await db.query(
        `INSERT INTO rules VALUES ('c', 'Borrada', 2, 1, 'x', ?, '2026-01-01', '', '2026-02-01')`,
        [actions]
      )
      await new MigrateRulesToAutomations1729700000000().up(db.createQueryRunner())

      const rows = await db.getRepository(AutomationModel).find({ order: { id: 'ASC' } })
      expect(rows.map((r) => [r.id, r.name, r.status, r.versionNumber])).toEqual([
        ['a', 'Activa', 'active', 1],
        ['b', 'Pausada', 'paused', 1]
      ])
      const version = await db
        .getRepository(AutomationVersionModel)
        .findOneByOrFail({ automationId: 'a' })
      expect(version.id).toBe(stableId('automation-version:a'))
      expect(rows[0].versionId).toBe(version.id)
      expect(version.definition.nodes.n1.params).toEqual({ tag: 'nurture' })
      expect(await db.createQueryRunner().hasTable('rules')).toBe(false)
    } finally {
      await db.destroy()
    }
  })
})
