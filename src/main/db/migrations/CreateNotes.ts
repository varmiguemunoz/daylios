import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

/** Crea la tabla `notes`. */
export class CreateNotes1727800000001 implements MigrationInterface {
  name = 'CreateNotes1727800000001'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'notes',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'body', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ],
        indices: [{ name: 'idx_notes_date', columnNames: ['date', 'updated_at'] }]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('notes', true)
  }
}
