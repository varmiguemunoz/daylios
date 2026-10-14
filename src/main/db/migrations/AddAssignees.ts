import { TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

const TABLES = ['tasks', 'prospects', 'projects', 'meetings']

export class AddAssignees1729200000000 implements MigrationInterface {
  name = 'AddAssignees1729200000000'

  async up(query: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (!(await query.hasColumn(table, 'assignee_id'))) {
        await query.addColumn(
          table,
          new TableColumn({ name: 'assignee_id', type: 'text', isNullable: true })
        )
      }
    }
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_assignee', columnNames: ['assignee_id', 'status'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropIndex('tasks', 'idx_tasks_assignee')
    for (const table of TABLES) await query.dropColumn(table, 'assignee_id')
  }
}
