import { Table, TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

/** Id fijo del pipeline inicial: las etapas existentes pasan a él. */
export const DEFAULT_PIPELINE_ID = '00000000-0000-4000-8000-000000000001'

/** Varios pipelines. El actual pasa a llamarse «Ventas» con sus etapas y prospectos. */
export class AddPipelines1728600000000 implements MigrationInterface {
  name = 'AddPipelines1728600000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'pipelines',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'position', type: 'integer', default: 0 },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ]
      }),
      true
    )
    const now = new Date().toISOString()
    await query.query('INSERT INTO pipelines (id, name, position, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', [
      DEFAULT_PIPELINE_ID,
      'Ventas',
      now,
      now
    ])
    if (!(await query.hasColumn('pipeline_stages', 'pipeline_id'))) {
      await query.addColumn(
        'pipeline_stages',
        new TableColumn({ name: 'pipeline_id', type: 'text', default: `'${DEFAULT_PIPELINE_ID}'` })
      )
    }
    await query.query('UPDATE pipeline_stages SET pipeline_id = ?', [DEFAULT_PIPELINE_ID])
    await query.createIndex(
      'pipeline_stages',
      new TableIndex({ name: 'idx_stages_pipeline', columnNames: ['pipeline_id', 'position'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropIndex('pipeline_stages', 'idx_stages_pipeline')
    await query.dropColumn('pipeline_stages', 'pipeline_id')
    await query.dropTable('pipelines', true)
  }
}
