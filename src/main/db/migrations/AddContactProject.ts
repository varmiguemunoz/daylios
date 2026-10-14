import { TableColumn, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddContactProject1728500000000 implements MigrationInterface {
  name = 'AddContactProject1728500000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasColumn('contacts', 'project_id'))) {
      await query.addColumn(
        'contacts',
        new TableColumn({ name: 'project_id', type: 'text', isNullable: true })
      )
    }
    await query.createIndex(
      'contacts',
      new TableIndex({ name: 'idx_contacts_project', columnNames: ['project_id'] })
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropIndex('contacts', 'idx_contacts_project')
    await query.dropColumn('contacts', 'project_id')
  }
}
