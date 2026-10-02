import { EntitySchema } from 'typeorm'
import type { Contact } from '@shared/consultora'

/** Personas de clientes y prospectos (base de contactos). */
export const ContactModel = new EntitySchema<Contact>({
  name: 'Contact',
  tableName: 'contacts',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    role: { type: 'text', nullable: true },
    email: { type: 'text', nullable: true },
    phone: { type: 'text', nullable: true },
    linkedin: { type: 'text', nullable: true },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    clientId: { name: 'client_id', type: 'text', nullable: true },
    prospectId: { name: 'prospect_id', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [
    { name: 'idx_contacts_client', columns: ['clientId'] },
    { name: 'idx_contacts_prospect', columns: ['prospectId'] }
  ]
})
