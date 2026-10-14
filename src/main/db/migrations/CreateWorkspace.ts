import { Table, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

export class CreateWorkspace1728700000000 implements MigrationInterface {
  name = 'CreateWorkspace1728700000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'workspace_items',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'kind', type: 'text' },
          { name: 'path', type: 'text', isUnique: true },
          { name: 'name', type: 'text' },
          { name: 'parent_id', type: 'text', isNullable: true },
          { name: 'inode', type: 'text' },
          { name: 'size', type: 'integer', default: 0 },
          { name: 'mtime_ms', type: 'real', default: 0 },
          { name: 'text', type: 'text', isNullable: true },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ]
      }),
      true
    )
    await query.createIndex(
      'workspace_items',
      new TableIndex({ name: 'idx_workspace_parent', columnNames: ['parent_id'] })
    )
    await query.createIndex(
      'workspace_items',
      new TableIndex({ name: 'idx_workspace_inode', columnNames: ['inode'] })
    )

    await query.createTable(
      new Table({
        name: 'workspace_refs',
        columns: [
          { name: 'from_id', type: 'text', isPrimary: true },
          { name: 'to_id', type: 'text', isPrimary: true }
        ]
      }),
      true
    )
    await query.createIndex(
      'workspace_refs',
      new TableIndex({ name: 'idx_workspace_refs_to', columnNames: ['to_id'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('workspace_refs', true)
    await query.dropTable('workspace_items', true)
  }
}
