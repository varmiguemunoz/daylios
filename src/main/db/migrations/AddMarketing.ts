import { Table, TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm'

/**
 * Email marketing: los contactos pasan a ser también leads (estado de suscripción, fuente,
 * campos, consentimiento), más tags, línea de tiempo, fuentes, reglas, newsletters, la cola
 * hacia Resend y los recibos de la cola del Worker.
 *
 * Los contactos existentes quedan con estado `none` (nunca reciben marketing sin opt-in).
 */
export class AddMarketing1728100000000 implements MigrationInterface {
  name = 'AddMarketing1728100000000'

  async up(query: QueryRunner): Promise<void> {
    // Nombre opcional (un lead puede llegar solo con email). En SQLite esto recrea la tabla.
    await query.changeColumn(
      'contacts',
      'name',
      new TableColumn({ name: 'name', type: 'text', isNullable: true })
    )
    const add = (column: TableColumn): Promise<void> => query.addColumn('contacts', column)
    await add(new TableColumn({ name: 'status', type: 'text', default: "'none'" }))
    await add(new TableColumn({ name: 'source', type: 'text', isNullable: true }))
    await add(new TableColumn({ name: 'fields', type: 'text', default: "'{}'" }))
    await add(new TableColumn({ name: 'consent_at', type: 'text', isNullable: true }))
    await add(new TableColumn({ name: 'sync_error', type: 'text', isNullable: true }))
    await add(new TableColumn({ name: 'synced_at', type: 'text', isNullable: true }))

    // Email en minúsculas y único. Si hubiera repetidos, el primero lo conserva y los demás
    // lo pierden con una nota, para que la migración nunca falle.
    await query.query(`UPDATE contacts SET email = NULLIF(lower(trim(email)), '')`)
    const dupes: { id: string; email: string }[] = await query.query(
      `SELECT id, email FROM contacts c WHERE email IS NOT NULL AND EXISTS (
         SELECT 1 FROM contacts o WHERE o.email = c.email
           AND (o.created_at < c.created_at OR (o.created_at = c.created_at AND o.id < c.id)))`
    )
    for (const d of dupes) {
      await query.query(
        `UPDATE contacts SET email = NULL,
           notes_md = notes_md || ? WHERE id = ?`,
        [`\n\nEmail duplicado con otro contacto: ${d.email}`, d.id]
      )
    }
    await query.query(`CREATE UNIQUE INDEX idx_contacts_email ON contacts (email)`)
    await query.query(`CREATE INDEX idx_contacts_status ON contacts (status)`)

    await query.createTable(
      new Table({
        name: 'tags',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'slug', type: 'text', isUnique: true },
          { name: 'name', type: 'text' },
          { name: 'segment_id', type: 'text', isNullable: true },
          { name: 'created_at', type: 'text' }
        ]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'contact_tags',
        columns: [
          { name: 'contact_id', type: 'text', isPrimary: true },
          { name: 'tag_id', type: 'text', isPrimary: true },
          { name: 'created_at', type: 'text' }
        ],
        indices: [{ name: 'idx_contact_tags_tag', columnNames: ['tag_id'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'contact_events',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'contact_id', type: 'text' },
          { name: 'type', type: 'text' },
          { name: 'detail', type: 'text', default: "'{}'" },
          { name: 'created_at', type: 'text' }
        ],
        indices: [{ name: 'idx_contact_events_contact', columnNames: ['contact_id', 'created_at'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'lead_sources',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'slug', type: 'text', isUnique: true },
          { name: 'name', type: 'text' },
          { name: 'secret', type: 'text' },
          { name: 'default_tags', type: 'text', default: "'[]'" },
          { name: 'received_count', type: 'integer', default: 0 },
          { name: 'last_received_at', type: 'text', isNullable: true },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'rules',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'position', type: 'integer', default: 0 },
          { name: 'active', type: 'boolean', default: 1 },
          { name: 'trigger_tag', type: 'text' },
          { name: 'actions', type: 'text', default: "'[]'" },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'newsletters',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'day', type: 'text' },
          { name: 'tag', type: 'text' },
          { name: 'subject', type: 'text' },
          { name: 'html', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'broadcast_id', type: 'text', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'scheduled_at', type: 'text', isNullable: true },
          { name: 'created_at', type: 'text' },
          { name: 'updated_at', type: 'text' }
        ],
        indices: [{ name: 'idx_newsletters_day', columnNames: ['day'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'resend_outbox',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'kind', type: 'text' },
          { name: 'ref', type: 'text' },
          { name: 'payload', type: 'text', default: "'{}'" },
          { name: 'attempts', type: 'integer', default: 0 },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'next_at', type: 'text' },
          { name: 'created_at', type: 'text' }
        ],
        indices: [{ name: 'idx_outbox_next', columnNames: ['next_at'] }]
      }),
      true
    )

    await query.createTable(
      new Table({
        name: 'hub_receipts',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'processed_at', type: 'text' }
        ]
      }),
      true
    )
  }

  async down(query: QueryRunner): Promise<void> {
    for (const table of [
      'hub_receipts',
      'resend_outbox',
      'newsletters',
      'rules',
      'lead_sources',
      'contact_events',
      'contact_tags',
      'tags'
    ]) {
      await query.dropTable(table, true)
    }
    await query.query(`DROP INDEX IF EXISTS idx_contacts_status`)
    await query.query(`DROP INDEX IF EXISTS idx_contacts_email`)
    for (const column of ['synced_at', 'sync_error', 'consent_at', 'fields', 'source', 'status']) {
      await query.dropColumn('contacts', column)
    }
  }
}
