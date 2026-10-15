import { EntitySchema } from 'typeorm'
import { DELETED_AT, type SoftDeletable } from './soft-delete'
import type {
  Automation,
  AutomationRun,
  AutomationVersion,
  RunStep,
  StoredEvent,
  TriggerLogEntry
} from '@shared/automations'

export type AutomationRow = Omit<Automation, 'versionNumber'> & {
  versionNumber: number | null
  updatedBy?: string | null
} & SoftDeletable

export const AutomationModel = new EntitySchema<AutomationRow>({
  name: 'Automation',
  tableName: 'automations',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    status: { type: 'text', default: 'draft' },
    draft: { type: 'simple-json' },
    versionId: { name: 'version_id', type: 'text', nullable: true },
    versionNumber: { name: 'version_number', type: 'integer', nullable: true },
    destructive: { type: 'boolean', default: false },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' },
    deletedAt: DELETED_AT
  }
})

export const AutomationVersionModel = new EntitySchema<
  AutomationVersion & { createdAt: string; updatedAt: string }
>({
  name: 'AutomationVersion',
  tableName: 'automation_versions',
  columns: {
    id: { type: 'text', primary: true },
    automationId: { name: 'automation_id', type: 'text' },
    number: { type: 'integer' },
    definition: { type: 'simple-json' },
    publishedAt: { name: 'published_at', type: 'text' },
    publishedBy: { name: 'published_by', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [{ name: 'uq_automation_versions', columns: ['automationId', 'number'], unique: true }]
})

export const AutomationEventModel = new EntitySchema<StoredEvent>({
  name: 'AutomationEvent',
  tableName: 'automation_events',
  columns: {
    id: { type: 'text', primary: true },
    type: { type: 'text' },
    subject: { type: 'simple-json' },
    payload: { type: 'simple-json', default: '{}' },
    cause: { type: 'simple-json', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    processedAt: { name: 'processed_at', type: 'text', nullable: true }
  },
  indices: [{ name: 'idx_aevents_pending', columns: ['processedAt', 'createdAt'] }]
})

export const AutomationRunModel = new EntitySchema<AutomationRun>({
  name: 'AutomationRun',
  tableName: 'automation_runs',
  columns: {
    id: { type: 'text', primary: true },
    automationId: { name: 'automation_id', type: 'text' },
    versionId: { name: 'version_id', type: 'text' },
    subjectType: { name: 'subject_type', type: 'text' },
    subjectId: { name: 'subject_id', type: 'text', nullable: true },
    triggerId: { name: 'trigger_id', type: 'text', nullable: true },
    event: { type: 'simple-json' },
    status: { type: 'text' },
    nodeId: { name: 'node_id', type: 'text', nullable: true },
    nextAt: { name: 'next_at', type: 'text', nullable: true },
    wait: { type: 'simple-json', nullable: true },
    attempts: { type: 'integer', default: 0 },
    outputs: { type: 'simple-json', default: '{}' },
    depth: { type: 'integer', default: 0 },
    chain: { type: 'simple-json', default: '[]' },
    causeRunId: { name: 'cause_run_id', type: 'text', nullable: true },
    late: { type: 'boolean', default: false },
    reason: { type: 'text', nullable: true },
    origin: { type: 'text', default: 'system' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' },
    finishedAt: { name: 'finished_at', type: 'text', nullable: true }
  },
  indices: [
    { name: 'idx_aruns_due', columns: ['status', 'nextAt'] },
    { name: 'idx_aruns_auto', columns: ['automationId', 'createdAt'] },
    { name: 'idx_aruns_subject', columns: ['subjectType', 'subjectId', 'automationId'] }
  ]
})

export const RunStepModel = new EntitySchema<RunStep>({
  name: 'RunStep',
  tableName: 'automation_run_steps',
  columns: {
    id: { type: 'text', primary: true },
    runId: { name: 'run_id', type: 'text' },
    automationId: { name: 'automation_id', type: 'text' },
    nodeId: { name: 'node_id', type: 'text' },
    nodeType: { name: 'node_type', type: 'text' },
    status: { type: 'text' },
    attempt: { type: 'integer', default: 1 },
    message: { type: 'text', nullable: true },
    output: { type: 'simple-json', nullable: true },
    startedAt: { name: 'started_at', type: 'text' },
    endedAt: { name: 'ended_at', type: 'text', nullable: true }
  },
  indices: [
    { name: 'idx_asteps_run', columns: ['runId', 'startedAt'] },
    { name: 'idx_asteps_node', columns: ['automationId', 'nodeId', 'status'] }
  ]
})

export const TriggerLogModel = new EntitySchema<TriggerLogEntry>({
  name: 'TriggerLog',
  tableName: 'automation_trigger_log',
  columns: {
    id: { type: 'text', primary: true },
    automationId: { name: 'automation_id', type: 'text' },
    triggerId: { name: 'trigger_id', type: 'text' },
    eventId: { name: 'event_id', type: 'text' },
    subjectId: { name: 'subject_id', type: 'text', nullable: true },
    outcome: { type: 'text' },
    reason: { type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' }
  },
  indices: [{ name: 'idx_atrigger_log', columns: ['automationId', 'createdAt'] }]
})

export const AUTOMATION_ENTITIES = [
  AutomationModel,
  AutomationVersionModel,
  AutomationEventModel,
  AutomationRunModel,
  RunStepModel,
  TriggerLogModel
]
