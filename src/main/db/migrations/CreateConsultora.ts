import { randomUUID } from 'crypto'
import { Table, type MigrationInterface, type QueryRunner, type TableColumnOptions } from 'typeorm'

const id: TableColumnOptions = { name: 'id', type: 'text', isPrimary: true }
const text = (name: string): TableColumnOptions => ({ name, type: 'text' })
const optional = (name: string, type = 'text'): TableColumnOptions => ({
  name,
  type,
  isNullable: true
})
const markdown = (name: string): TableColumnOptions => ({ name, type: 'text', default: "''" })
const stamps = [text('created_at'), text('updated_at')]

/** Etapas por defecto del pipeline (se pueden cambiar en Ajustes). */
const DEFAULT_STAGES: [name: string, kind: string][] = [
  ['Contacto inicial', 'open'],
  ['Discovery', 'open'],
  ['Propuesta', 'open'],
  ['Negociación', 'open'],
  ['Ganado', 'won'],
  ['Perdido', 'lost']
]

/** Tablas de la Consultora: clientes, proyectos, etapas, prospectos y reuniones. */
export class CreateConsultora1727900000000 implements MigrationInterface {
  name = 'CreateConsultora1727900000000'

  async up(query: QueryRunner): Promise<void> {
    await query.createTable(
      new Table({
        name: 'clients',
        columns: [
          id,
          text('name'),
          optional('sector'),
          text('status'),
          markdown('contacts_md'),
          markdown('notes_md'),
          optional('signed_at'),
          text('folder_path'),
          ...stamps
        ]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'projects',
        columns: [
          id,
          text('client_id'),
          text('name'),
          text('status'),
          markdown('objective_md'),
          markdown('deliverables_md'),
          markdown('notes_md'),
          ...stamps
        ],
        indices: [{ name: 'idx_projects_client', columnNames: ['client_id'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'pipeline_stages',
        columns: [id, text('name'), { name: 'position', type: 'integer' }, text('kind')]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'prospects',
        columns: [
          id,
          text('company'),
          markdown('contact_md'),
          optional('value_usd', 'real'),
          optional('source'),
          text('stage_id'),
          markdown('notes_md'),
          optional('next_step'),
          optional('next_step_date'),
          optional('client_id'),
          ...stamps
        ],
        indices: [{ name: 'idx_prospects_stage', columnNames: ['stage_id'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'meetings',
        columns: [
          id,
          text('date'),
          text('title'),
          optional('client_id'),
          optional('project_id'),
          optional('prospect_id'),
          text('participants'),
          markdown('summary_md'),
          markdown('decisions_md'),
          text('action_items'),
          markdown('transcript_md'),
          markdown('raw_notes_md'),
          optional('recording_path'),
          optional('duration_sec', 'integer'),
          text('status'),
          optional('error'),
          ...stamps
        ],
        indices: [
          { name: 'idx_meetings_date', columnNames: ['date'] },
          { name: 'idx_meetings_client', columnNames: ['client_id'] },
          { name: 'idx_meetings_project', columnNames: ['project_id'] }
        ]
      }),
      true
    )

    // Etapas por defecto, con el query builder de TypeORM (sin SQL a mano).
    await query.manager
      .createQueryBuilder()
      .insert()
      .into('pipeline_stages')
      .values(
        DEFAULT_STAGES.map(([name, kind], position) => ({ id: randomUUID(), name, position, kind }))
      )
      .execute()
  }

  async down(query: QueryRunner): Promise<void> {
    for (const table of ['meetings', 'prospects', 'pipeline_stages', 'projects', 'clients']) {
      await query.dropTable(table, true)
    }
  }
}
