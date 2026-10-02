import { EntitySchema } from 'typeorm'
import type { Client } from '@shared/consultora'

export const ClientModel = new EntitySchema<Client>({
  name: 'Client',
  tableName: 'clients',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    sector: { type: 'text', nullable: true },
    status: { type: 'text' },
    contactsMd: { name: 'contacts_md', type: 'text', default: '' },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    signedAt: { name: 'signed_at', type: 'text', nullable: true },
    folderPath: { name: 'folder_path', type: 'text' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  }
})
