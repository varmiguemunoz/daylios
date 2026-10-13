import { EntitySchema } from 'typeorm'
import type { PipelineRef } from '@shared/consultora'

/** Pipelines (uno por oferta, p. ej.). Sus columnas viven en `pipeline_stages`. */
export interface PipelineRow extends PipelineRef {
  createdAt: string
  updatedAt: string
}

export const PipelineModel = new EntitySchema<PipelineRow>({
  name: 'Pipeline',
  tableName: 'pipelines',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    position: { type: 'integer', default: 0 },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  }
})
