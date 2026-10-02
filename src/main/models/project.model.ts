import { EntitySchema } from 'typeorm'
import type { Project } from '@shared/consultora'

export const ProjectModel = new EntitySchema<Project>({
  name: 'Project',
  tableName: 'projects',
  columns: {
    id: { type: 'text', primary: true },
    clientId: { name: 'client_id', type: 'text' },
    name: { type: 'text' },
    status: { type: 'text' },
    objectiveMd: { name: 'objective_md', type: 'text', default: '' },
    deliverablesMd: { name: 'deliverables_md', type: 'text', default: '' },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [{ name: 'idx_projects_client', columns: ['clientId'] }]
})
