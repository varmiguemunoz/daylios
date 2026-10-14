import { TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddTaskStatusAndLinks1728800000000 implements MigrationInterface {
  name = 'AddTaskStatusAndLinks1728800000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasColumn('tasks', 'status'))) {
      await query.addColumn(
        'tasks',
        new TableColumn({ name: 'status', type: 'text', isNullable: false, default: "'todo'" })
      )
      await query.query(`UPDATE tasks SET status = 'done' WHERE done = 1`)
    }
    for (const name of ['client_id', 'project_id', 'prospect_id']) {
      if (!(await query.hasColumn('tasks', name))) {
        await query.addColumn('tasks', new TableColumn({ name, type: 'text', isNullable: true }))
      }
    }
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_status', columnNames: ['status', 'date'] })
    )
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_client', columnNames: ['client_id'] })
    )
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_project', columnNames: ['project_id'] })
    )
    await query.createIndex(
      'tasks',
      new TableIndex({ name: 'idx_tasks_prospect', columnNames: ['prospect_id'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    for (const index of [
      'idx_tasks_status',
      'idx_tasks_client',
      'idx_tasks_project',
      'idx_tasks_prospect'
    ]) {
      await query.dropIndex('tasks', index)
    }
    for (const name of ['status', 'client_id', 'project_id', 'prospect_id'])
      await query.dropColumn('tasks', name)
  }
}
