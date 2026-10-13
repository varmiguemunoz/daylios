import { TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'

/** Tags audiencia: solo ellos tienen Segment en Resend. Los que ya tienen uno quedan como audiencia. */
export class AddTagAudience1728300000000 implements MigrationInterface {
  name = 'AddTagAudience1728300000000'

  async up(query: QueryRunner): Promise<void> {
    if (!(await query.hasColumn('tags', 'audience'))) {
      await query.addColumn('tags', new TableColumn({ name: 'audience', type: 'boolean', default: 0 }))
    }
    await query.query('UPDATE tags SET audience = 1 WHERE segment_id IS NOT NULL')
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropColumn('tags', 'audience')
  }
}
