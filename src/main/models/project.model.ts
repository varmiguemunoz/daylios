import { EntitySchema } from 'typeorm'
import { DELETED_AT, type SoftDeletable } from './soft-delete'
import type { Project } from '@shared/consultora'

export const ProjectModel = new EntitySchema<Project & SoftDeletable>({
  name: 'Project',
  tableName: 'projects',
  columns: {
    id: { type: 'text', primary: true },
    clientId: { name: 'client_id', type: 'text' },
    assigneeId: { name: 'assignee_id', type: 'text', nullable: true },
    name: { type: 'text' },
    status: { type: 'text' },
    objectiveMd: { name: 'objective_md', type: 'text', default: '' },
    deliverablesMd: { name: 'deliverables_md', type: 'text', default: '' },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' },
    deletedAt: DELETED_AT
  },
  indices: [{ name: 'idx_projects_client', columns: ['clientId'] }]
})
