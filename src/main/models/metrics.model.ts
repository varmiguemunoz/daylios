import { EntitySchema } from 'typeorm'
import type { StageKind } from '@shared/consultora'

export interface StageEventRow {
  id: string
  prospectId: string
  pipelineId: string | null
  fromStageId: string | null
  toStageId: string
  toKind: StageKind

  valueUsd: number | null

  source: 'app' | 'backfill'
  at: string
}

export const StageEventModel = new EntitySchema<StageEventRow>({
  name: 'StageEvent',
  tableName: 'prospect_stage_events',
  columns: {
    id: { type: 'text', primary: true },
    prospectId: { name: 'prospect_id', type: 'text' },
    pipelineId: { name: 'pipeline_id', type: 'text', nullable: true },
    fromStageId: { name: 'from_stage_id', type: 'text', nullable: true },
    toStageId: { name: 'to_stage_id', type: 'text' },
    toKind: { name: 'to_kind', type: 'text' },
    valueUsd: { name: 'value_usd', type: 'real', nullable: true },
    source: { type: 'text', default: 'app' },
    at: { type: 'text' }
  },
  indices: [
    { name: 'idx_stage_events_kind_at', columns: ['toKind', 'at'] },
    { name: 'idx_stage_events_prospect', columns: ['prospectId', 'at'] }
  ]
})

export interface DashboardRow {
  id: string
  name: string
  owner: string
  layout: string
  updatedAt: string
}

export const DashboardModel = new EntitySchema<DashboardRow>({
  name: 'Dashboard',
  tableName: 'dashboards',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    owner: { type: 'text', default: 'local' },
    layout: { type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  }
})
