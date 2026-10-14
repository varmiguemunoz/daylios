import { randomUUID } from 'crypto'
import { Table, TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'
import { SOFT_DELETE_TABLES, SYNC_TABLES } from '@shared/edition'
import { DEFAULT_PIPELINE_ID } from './AddPipelines'

export class AddSyncMetadata1729000000000 implements MigrationInterface {
  name = 'AddSyncMetadata1729000000000'

  async up(query: QueryRunner): Promise<void> {
    for (const name of SYNC_TABLES) {
      if (!(await query.hasTable(name))) continue
      const wanted = [
        ...((SOFT_DELETE_TABLES as string[]).includes(name) ? ['deleted_at'] : []),
        'rev',
        'org_id',
        'updated_by'
      ]
      const missing: TableColumn[] = []
      for (const column of wanted) {
        if (!(await query.hasColumn(name, column)))
          missing.push(new TableColumn({ name: column, type: 'text', isNullable: true }))
      }
      // Una sola reconstrucción por tabla en SQLite.
      if (missing.length) await query.addColumns(name, missing)
    }

    await query.query(`DROP INDEX IF EXISTS idx_contacts_email`)
    await query.query(
      `CREATE UNIQUE INDEX idx_contacts_email ON contacts (email) WHERE deleted_at IS NULL`
    )
    for (const name of ['tags', 'lead_sources']) {
      await dropColumnUnique(query, name, 'slug')
      await query.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_${name}_slug ON ${name} (slug) WHERE deleted_at IS NULL`
      )
    }

    const pipelineId = randomUUID()
    await query.query(`UPDATE pipelines SET id = ? WHERE id = ?`, [pipelineId, DEFAULT_PIPELINE_ID])
    await query.query(`UPDATE pipeline_stages SET pipeline_id = ? WHERE pipeline_id = ?`, [
      pipelineId,
      DEFAULT_PIPELINE_ID
    ])
    await query.query(`UPDATE prospect_stage_events SET pipeline_id = ? WHERE pipeline_id = ?`, [
      pipelineId,
      DEFAULT_PIPELINE_ID
    ])
    await query.query(`UPDATE dashboards SET layout = replace(layout, ?, ?)`, [
      DEFAULT_PIPELINE_ID,
      pipelineId
    ])
    await query.query(`UPDATE dashboards SET id = ? WHERE id = 'default'`, [randomUUID()])

    await query.createTable(
      new Table({
        name: 'change_log',
        columns: [
          {
            name: 'seq',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          { name: 'entity', type: 'text' },
          { name: 'entity_id', type: 'text' },
          { name: 'op', type: 'text' },
          { name: 'fields', type: 'text', isNullable: true },
          { name: 'rev', type: 'text', isNullable: true },
          { name: 'at', type: 'text' }
        ],
        indices: [{ name: 'idx_change_log_entity', columnNames: ['entity', 'entity_id'] }]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('change_log', true)
  }
}

async function dropColumnUnique(query: QueryRunner, table: string, column: string): Promise<void> {
  const current = await query.getTable(table)
  const col = current?.findColumnByName(column)
  if (!current || !col) return
  const unique = current.uniques.find(
    (u) => u.columnNames.length === 1 && u.columnNames[0] === column
  )
  if (unique) await query.dropUniqueConstraint(current, unique)
  const after = await query.getTable(table)
  const still = after?.findColumnByName(column)
  if (after && still?.isUnique) {
    const next = still.clone()
    next.isUnique = false
    await query.changeColumn(after, still, next)
  }
}
