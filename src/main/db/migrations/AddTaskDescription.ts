import { TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddTaskDescription1727800000000 implements MigrationInterface {
  name = 'AddTaskDescription1727800000000'

  async up(query: QueryRunner): Promise<void> {
    if (await query.hasColumn('tasks', 'description')) return
    await query.addColumn(
      'tasks',
      new TableColumn({ name: 'description', type: 'text', isNullable: true })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropColumn('tasks', 'description')
  }
}
