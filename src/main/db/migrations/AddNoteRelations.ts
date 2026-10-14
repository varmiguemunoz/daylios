import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddNoteRelations1728400000000 implements MigrationInterface {
  name = 'AddNoteRelations1728400000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'note_relations',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'note_id', type: 'text' },
          { name: 'target_type', type: 'text' },
          { name: 'target_id', type: 'text' },
          { name: 'created_at', type: 'text' }
        ],
        indices: [
          {
            name: 'uq_note_relations',
            columnNames: ['note_id', 'target_type', 'target_id'],
            isUnique: true
          },
          { name: 'idx_note_relations_target', columnNames: ['target_type', 'target_id'] }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('note_relations', true)
  }
}
