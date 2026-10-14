import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddFileManifest1729400000000 implements MigrationInterface {
  name = 'AddFileManifest1729400000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'file_manifest',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'path', type: 'text' },
          { name: 'hash', type: 'text' },
          { name: 'size', type: 'integer' },
          { name: 'mtime', type: 'text' },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' },
          { name: 'deleted_at', type: 'text', isNullable: true },
          { name: 'rev', type: 'text', isNullable: true },
          { name: 'org_id', type: 'text', isNullable: true },
          { name: 'updated_by', type: 'text', isNullable: true }
        ]
      }),
      true
    )
    await query.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_file_manifest_path ON file_manifest (path) WHERE deleted_at IS NULL`
    )
    await query.query(`CREATE INDEX IF NOT EXISTS idx_file_manifest_hash ON file_manifest (hash)`)
    await query.createTable(
      new Table({
        name: 'file_state',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'path', type: 'text' },
          { name: 'local_hash', type: 'text' },
          { name: 'synced_hash', type: 'text', isNullable: true },
          { name: 'size', type: 'integer' },
          { name: 'mtime_ms', type: 'integer' }
        ]
      }),
      true
    )
    await query.query(`CREATE INDEX IF NOT EXISTS idx_file_state_path ON file_state (path)`)
    await query.createTable(
      new Table({
        name: 'file_uploads',
        columns: [
          { name: 'hash', type: 'text', isPrimary: true },
          { name: 'upload_id', type: 'text' },
          { name: 'done', type: 'text', default: "'[]'" }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('file_uploads', true)
    await query.dropTable('file_state', true)
    await query.dropTable('file_manifest', true)
  }
}
