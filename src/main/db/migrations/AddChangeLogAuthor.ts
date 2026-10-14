import { TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddChangeLogAuthor1729100000000 implements MigrationInterface {
  name = 'AddChangeLogAuthor1729100000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasColumn('change_log', 'by'))) {
      await query.addColumn(
        'change_log',
        new TableColumn({ name: 'by', type: 'text', isNullable: true })
      )
    }
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropColumn('change_log', 'by')
  }
}
