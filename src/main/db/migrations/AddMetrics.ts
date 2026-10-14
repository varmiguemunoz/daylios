import { Table, TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddMetrics1728900000000 implements MigrationInterface {
  name = 'AddMetrics1728900000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'prospect_stage_events',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'prospect_id', type: 'text' },
          { name: 'pipeline_id', type: 'text', isNullable: true },
          { name: 'from_stage_id', type: 'text', isNullable: true },
          { name: 'to_stage_id', type: 'text' },
          { name: 'to_kind', type: 'text' },
          { name: 'value_usd', type: 'real', isNullable: true },
          { name: 'source', type: 'text', default: "'app'" },
          { name: 'at', type: 'text' }
        ]
      }),
      true
    )
    await query.createIndex(
      'prospect_stage_events',
      new TableIndex({ name: 'idx_stage_events_kind_at', columnNames: ['to_kind', 'at'] })
    )
    await query.createIndex(
      'prospect_stage_events',
      new TableIndex({ name: 'idx_stage_events_prospect', columnNames: ['prospect_id', 'at'] })
    )

    if (!(await query.hasColumn('prospects', 'closed_at'))) {
      await query.addColumn(
        'prospects',
        new TableColumn({ name: 'closed_at', type: 'text', isNullable: true })
      )
    }
    await query.query(
      `UPDATE prospects SET closed_at = updated_at
       WHERE stage_id IN (SELECT id FROM pipeline_stages WHERE kind IN ('won', 'lost'))`
    )
    await query.query(
      `INSERT INTO prospect_stage_events
         (id, prospect_id, pipeline_id, from_stage_id, to_stage_id, to_kind, value_usd, source, at)
       SELECT 'backfill-' || p.id, p.id, s.pipeline_id, NULL, s.id, s.kind, p.value_usd, 'backfill', p.updated_at
       FROM prospects p JOIN pipeline_stages s ON s.id = p.stage_id
       WHERE s.kind IN ('won', 'lost')`
    )

    await query.createTable(
      new Table({
        name: 'dashboards',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'owner', type: 'text', default: "'local'" },
          { name: 'layout', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('dashboards', true)
    await query.dropColumn('prospects', 'closed_at')
    await query.dropTable('prospect_stage_events', true)
  }
}
