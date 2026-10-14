import { EntitySchema } from 'typeorm'
import { DELETED_AT, type SoftDeletable } from './soft-delete'
import type { Stage } from '@shared/consultora'

export const StageModel = new EntitySchema<Stage & SoftDeletable>({
  name: 'Stage',
  tableName: 'pipeline_stages',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    position: { type: 'integer' },
    kind: { type: 'text' },
    pipelineId: { name: 'pipeline_id', type: 'text' },
    deletedAt: DELETED_AT
  },
  indices: [{ name: 'idx_stages_pipeline', columns: ['pipelineId', 'position'] }]
})
