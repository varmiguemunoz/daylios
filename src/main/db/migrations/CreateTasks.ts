import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

export class CreateTasks1727600000000 implements MigrationInterface {
  name = 'CreateTasks1727600000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'tasks',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'title', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'done', type: 'boolean', default: 0 },
          { name: 'position', type: 'integer' },
          { name: 'created_at', type: 'text' },
          { name: 'completed_at', type: 'text', isNullable: true },
          { name: 'carried_from', type: 'text', isNullable: true }
        ],
        indices: [{ name: 'idx_tasks_date', columnNames: ['date', 'position'] }]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('tasks', true)
  }
}
