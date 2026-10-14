import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddActivityCache1729500000000 implements MigrationInterface {
  name = 'AddActivityCache1729500000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'activity_cache',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true },
          { name: 'seq', type: 'integer' },
          { name: 'actor_id', type: 'text', isNullable: true },
          { name: 'verb', type: 'text' },
          { name: 'entity', type: 'text' },
          { name: 'entity_id', type: 'text' },
          { name: 'title', type: 'text', default: "''" },
          { name: 'detail', type: 'text', isNullable: true },
          { name: 'target_id', type: 'text', isNullable: true },
          { name: 'count', type: 'integer', default: 1 },
          { name: 'at', type: 'text' }
        ]
      }),
      true
    )
    await query.query(`CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_cache (at)`)
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_cache (entity, entity_id)`
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('activity_cache', true)
  }
}
