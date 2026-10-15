import { createHash } from 'crypto'
import type { MigrationInterface, QueryRunner } from 'typeorm'
import {
  emptyDefinition,
  insert,
  ROOT_SLOT,
  type Definition,
  type NodeDef
} from '@shared/automations'

interface RuleRow {
  id: string
  name: string
  active: number
  trigger_tag: string
  actions: string
  created_at: string
  org_id?: string | null
}

interface StageRow {
  id: string
  name: string
  pipeline_id: string
  deleted_at?: string | null
}

type RuleAction =
  | { type: 'add_tag'; tag: string }
  | { type: 'remove_tag'; tag: string }
  | { type: 'fire_event'; event: string }
  | { type: 'promote'; stage: string }

export function stableId(seed: string): string {
  const h = createHash('sha1').update(seed).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function stageFor(stages: StageRow[], ref: string): StageRow | null {
  const key = ref.trim().toLowerCase()
  return (
    (key && stages.find((s) => s.id === ref || s.name.toLowerCase() === key)) || stages[0] || null
  )
}

function nodeOf(action: RuleAction, id: string, stages: StageRow[]): NodeDef | null {
  const base = { id, name: '', next: {} }
  if (action.type === 'add_tag')
    return { ...base, type: 'add_tag', name: 'Añadir tag', params: { tag: action.tag } }
  if (action.type === 'remove_tag')
    return { ...base, type: 'remove_tag', name: 'Quitar tag', params: { tag: action.tag } }
  if (action.type === 'fire_event')
    return {
      ...base,
      type: 'start_sequence',
      name: 'Iniciar secuencia',
      params: { event: action.event }
    }
  if (action.type === 'promote') {
    const stage = stageFor(stages, action.stage)
    return {
      ...base,
      type: 'create_prospect',
      name: 'Crear prospecto',
      params: { pipeline: stage?.pipeline_id ?? '', stage: stage?.id ?? '' }
    }
  }
  return null
}

export function ruleDefinition(rule: RuleRow, stages: StageRow[]): Definition {
  let def: Definition = {
    ...emptyDefinition('contact'),
    triggers: [
      { id: 't1', type: 'contact.tag_added', params: { tag: rule.trigger_tag }, conditions: [] }
    ]
  }
  let slot = ROOT_SLOT
  const actions = JSON.parse(rule.actions || '[]') as RuleAction[]
  actions.forEach((action, i) => {
    const node = nodeOf(action, `n${i + 1}`, stages)
    if (!node) return
    def = insert(def, slot, node)
    slot = { parent: node.id, port: 'next' }
  })
  return def
}

export class MigrateRulesToAutomations1729700000000 implements MigrationInterface {
  name = 'MigrateRulesToAutomations1729700000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasTable('rules'))) return
    const columns = (await query.query(`PRAGMA table_info(rules)`)) as { name: string }[]
    const has = (c: string): boolean => columns.some((col) => col.name === c)
    const rules = (await query.query(
      `SELECT * FROM rules ${has('deleted_at') ? 'WHERE deleted_at IS NULL' : ''} ORDER BY position`
    )) as RuleRow[]
    const stages = (
      (await query.query(`SELECT * FROM pipeline_stages ORDER BY position`)) as StageRow[]
    ).filter((s) => !s.deleted_at)
    const stamp = new Date().toISOString()
    for (const rule of rules) {
      const exists = (await query.query(`SELECT id FROM automations WHERE id = ?`, [
        rule.id
      ])) as unknown[]
      if (exists.length) continue
      const def = JSON.stringify(ruleDefinition(rule, stages))
      const versionId = stableId(`automation-version:${rule.id}`)
      const org = has('org_id') ? (rule.org_id ?? null) : null
      await query.query(
        `INSERT INTO automation_versions (id, automation_id, number, definition, published_at, published_by, created_at, updated_at, org_id)
         VALUES (?, ?, 1, ?, ?, NULL, ?, ?, ?)`,
        [versionId, rule.id, def, stamp, stamp, stamp, org]
      )
      await query.query(
        `INSERT INTO automations (id, name, status, draft, version_id, version_number, destructive, created_at, updated_at, org_id)
         VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
        [
          rule.id,
          rule.name || 'Regla',
          rule.active ? 'active' : 'paused',
          def,
          versionId,
          rule.created_at || stamp,
          stamp,
          org
        ]
      )
    }
    await query.query(`DROP TABLE rules`)
  }

  down(): Promise<void> {
    return Promise.resolve()
  }
}
