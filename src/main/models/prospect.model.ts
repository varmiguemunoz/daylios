import { EntitySchema } from 'typeorm'
import type { Prospect } from '@shared/consultora'

export const ProspectModel = new EntitySchema<Prospect>({
  name: 'Prospect',
  tableName: 'prospects',
  columns: {
    id: { type: 'text', primary: true },
    company: { type: 'text' },
    contactMd: { name: 'contact_md', type: 'text', default: '' },
    valueUsd: { name: 'value_usd', type: 'real', nullable: true },
    source: { type: 'text', nullable: true },
    stageId: { name: 'stage_id', type: 'text' },
    position: { type: 'integer', default: 0 },
    notesMd: { name: 'notes_md', type: 'text', default: '' },
    nextStep: { name: 'next_step', type: 'text', nullable: true },
    nextStepDate: { name: 'next_step_date', type: 'text', nullable: true },
    clientId: { name: 'client_id', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [{ name: 'idx_prospects_stage', columns: ['stageId'] }]
})
