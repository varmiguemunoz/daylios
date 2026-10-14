import { EntitySchema } from 'typeorm'
import { DELETED_AT, type SoftDeletable } from './soft-delete'
import type { Task } from '@shared/tasks'

export const TaskModel = new EntitySchema<Task & SoftDeletable>({
  name: 'Task',
  tableName: 'tasks',
  columns: {
    id: { type: 'text', primary: true },
    title: { type: 'text' },
    date: { type: 'text' },
    done: { type: 'boolean', default: false },
    position: { type: 'integer' },
    createdAt: { name: 'created_at', type: 'text' },
    completedAt: { name: 'completed_at', type: 'text', nullable: true },
    carriedFrom: { name: 'carried_from', type: 'text', nullable: true },
    description: { type: 'text', nullable: true },
    tags: { type: 'simple-json' },
    effort: { type: 'text', nullable: true },
    parentId: { name: 'parent_id', type: 'text', nullable: true },
    status: { type: 'text', default: 'todo' },
    clientId: { name: 'client_id', type: 'text', nullable: true },
    projectId: { name: 'project_id', type: 'text', nullable: true },
    prospectId: { name: 'prospect_id', type: 'text', nullable: true },
    assigneeId: { name: 'assignee_id', type: 'text', nullable: true },
    deletedAt: DELETED_AT
  },
  indices: [
    { name: 'idx_tasks_date', columns: ['date', 'position'] },
    { name: 'idx_tasks_parent', columns: ['parentId', 'position'] },
    { name: 'idx_tasks_status', columns: ['status', 'date'] },
    { name: 'idx_tasks_client', columns: ['clientId'] },
    { name: 'idx_tasks_project', columns: ['projectId'] },
    { name: 'idx_tasks_prospect', columns: ['prospectId'] },
    { name: 'idx_tasks_assignee', columns: ['assigneeId', 'status'] }
  ]
})
