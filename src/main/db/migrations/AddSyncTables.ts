import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddSyncTables1729300000000 implements MigrationInterface {
  name = 'AddSyncTables1729300000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'sync_state',
        columns: [
          { name: 'key', type: 'text', isPrimary: true },
          { name: 'value', type: 'text' }
        ]
      }),
      true
    )
    await query.createTable(
      new Table({
        name: 'sync_revs',
        columns: [
          { name: 'entity', type: 'text', isPrimary: true },
          { name: 'entity_id', type: 'text', isPrimary: true },
          { name: 'field', type: 'text', isPrimary: true },
          { name: 'rev', type: 'text' }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('sync_revs', true)
    await query.dropTable('sync_state', true)
  }
}
