import { EntitySchema } from 'typeorm'
import type { Contact } from '@shared/consultora'

/** Personas: de clientes y prospectos, y leads de email marketing (misma tabla). */
export const ContactModel = new EntitySchema<Contact>({
  name: 'Contact',
  tableName: 'contacts',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text', nullable: true },
    role: { type: 'text', nullable: true },
    email: { type: 'text', nullable: true },
    phone: { type: 'text', nullable: true },
    linkedin: { type: 'text', nullable: true },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    clientId: { name: 'client_id', type: 'text', nullable: true },
    prospectId: { name: 'prospect_id', type: 'text', nullable: true },
    status: { type: 'text', default: 'none' },
    source: { type: 'text', nullable: true },
    fields: { type: 'simple-json', default: '{}' },
    consentAt: { name: 'consent_at', type: 'text', nullable: true },
    syncError: { name: 'sync_error', type: 'text', nullable: true },
    syncedAt: { name: 'synced_at', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [
    { name: 'idx_contacts_client', columns: ['clientId'] },
    { name: 'idx_contacts_prospect', columns: ['prospectId'] },
    { name: 'idx_contacts_email', columns: ['email'], unique: true },
    { name: 'idx_contacts_status', columns: ['status'] }
  ]
})
