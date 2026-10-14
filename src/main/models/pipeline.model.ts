import { EntitySchema } from 'typeorm'
import { DELETED_AT, type SoftDeletable } from './soft-delete'
import type { PipelineRef } from '@shared/consultora'

export interface PipelineRow extends PipelineRef {
  createdAt: string
  updatedAt: string
}

export const PipelineModel = new EntitySchema<PipelineRow & SoftDeletable>({
  name: 'Pipeline',
  tableName: 'pipelines',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    position: { type: 'integer', default: 0 },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' },
    deletedAt: DELETED_AT
  }
})
