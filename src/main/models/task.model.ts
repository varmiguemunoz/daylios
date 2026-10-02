import { EntitySchema } from 'typeorm'
import type { Task } from '@shared/tasks'

/**
 * Modelo de la tabla `tasks`.
 * Usa el tipo `Task` compartido, así no hay una clase duplicada ni decoradores.
 */
export const TaskModel = new EntitySchema<Task>({
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
    description: { type: 'text', nullable: true }
  },
  indices: [{ name: 'idx_tasks_date', columns: ['date', 'position'] }]
})
