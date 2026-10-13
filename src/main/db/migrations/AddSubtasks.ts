import { TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

/** Subtareas: `tasks.parent_id`. Las tareas existentes quedan como madres (null). */
export class AddSubtasks1728200000000 implements MigrationInterface {
  name = 'AddSubtasks1728200000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasColumn('tasks', 'parent_id'))) {
      await query.addColumn('tasks', new TableColumn({ name: 'parent_id', type: 'text', isNullable: true }))
    }
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_parent', columnNames: ['parent_id', 'position'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropIndex('tasks', 'idx_tasks_parent')
    await query.dropColumn('tasks', 'parent_id')
  }
}
