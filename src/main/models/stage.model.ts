import { EntitySchema } from 'typeorm'
import type { Stage } from '@shared/consultora'

export const StageModel = new EntitySchema<Stage>({
  name: 'Stage',
  tableName: 'pipeline_stages',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    position: { type: 'integer' },
    kind: { type: 'text' }
  }
})
