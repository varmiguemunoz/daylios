import { Table, TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'

/**
 * Tags y esfuerzo en tareas, orden de prospectos dentro de su etapa, idioma de reuniones
 * y la tabla de contactos. Las filas existentes quedan sin tags, sin esfuerzo y con posición 0.
 */
export class AddTagsEffortContacts1728000000000 implements MigrationInterface {
  name = 'AddTagsEffortContacts1728000000000'

  async up(query: QueryRunner): Promise<void> {
    const add = async (table: string, column: TableColumn): Promise<void> => {
      if (!(await query.hasColumn(table, column.name))) await query.addColumn(table, column)
    }
    await add('tasks', new TableColumn({ name: 'tags', type: 'text', default: "'[]'" }))
    await add('tasks', new TableColumn({ name: 'effort', type: 'text', isNullable: true }))
    await add('prospects', new TableColumn({ name: 'position', type: 'integer', default: 0 }))
    await add('meetings', new TableColumn({ name: 'language', type: 'text', isNullable: true }))

    await query.createTable(
      new Table({
        name: 'contacts',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'role', type: 'text', isNullable: true },
          { name: 'email', type: 'text', isNullable: true },
          { name: 'phone', type: 'text', isNullable: true },
          { name: 'linkedin', type: 'text', isNullable: true },
          { name: 'notes_md', type: 'text', default: "''" },
          { name: 'client_id', type: 'text', isNullable: true },
          { name: 'prospect_id', type: 'text', isNullable: true },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ],
        indices: [
          { name: 'idx_contacts_client', columnNames: ['client_id'] },
          { name: 'idx_contacts_prospect', columnNames: ['prospect_id'] }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    await query.dropTable('contacts', true)
    await query.dropColumn('meetings', 'language')
    await query.dropColumn('prospects', 'position')
    await query.dropColumn('tasks', 'effort')
    await query.dropColumn('tasks', 'tags')
  }
}
