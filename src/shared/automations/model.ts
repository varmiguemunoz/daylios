export const SUBJECT_TYPES = ['contact', 'prospect', 'client', 'task', 'meeting', 'none'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  contact: 'Contacto',
  prospect: 'Prospecto',
  client: 'Cliente',
  task: 'Tarea',
  meeting: 'Reunión',
  none: 'Sin sujeto'
}

export const AUTOMATION_STATUSES = ['draft', 'active', 'paused', 'locked'] as const
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number]

export const TRIGGER_TYPES = [
  'contact.created',
  'contact.tag_added',
  'contact.tag_removed',
  'contact.updated',
  'contact.subscribed',
  'contact.unsubscribed',
  'contact.bounced',
  'prospect.created',
  'prospect.stage_changed',
  'prospect.won',
  'prospect.lost',
  'client.created',
  'task.completed',
  'meeting.ready',
  'schedule',
  'manual'
] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

export const NODE_TYPES = [
  'if_else',
  'wait',
  'go_to',
  'finish',
  'add_tag',
  'remove_tag',
  'update_contact',
  'set_field',
  'append_contact_note',
  'assign_client',
  'unassign_client',
  'assign_project',
  'unsubscribe',
  'delete_contact',
  'create_prospect',
  'move_prospect',
  'update_prospect',
  'delete_prospect',
  'create_client',
  'create_project',
  'send_email',
  'start_sequence',
  'email_owner',
  'create_task',
  'create_note',
  'notify_mac',
  'webhook'
] as const
export type NodeType = (typeof NODE_TYPES)[number]

export type TimeUnit = 'minutes' | 'hours' | 'days'
export const TIME_UNITS: TimeUnit[] = ['minutes', 'hours', 'days']

export const OPERATORS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'is_empty',
  'is_not_empty',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'before',
  'after',
  'within_days',
  'older_than_days',
  'includes',
  'excludes'
] as const
export type Operator = (typeof OPERATORS)[number]

export type ConditionValue = string | number | boolean | string[] | null

export interface Condition {
  field: string
  operator: Operator
  value?: ConditionValue
}

export interface ConditionGroup {
  join: 'and' | 'or'
  conditions: Condition[]
}

export interface Branch {
  id: string
  name: string
  groups: ConditionGroup[]
}

export type Params = Record<string, unknown>

export interface TriggerDef {
  id: string
  type: TriggerType
  params: Params
  conditions: ConditionGroup[]
}

export interface NodeDef {
  id: string
  type: NodeType
  name: string
  params: Params
  next: Record<string, string | null>
}

export interface TimeWindow {
  days: number[]
  start: string
  end: string
}

export interface Settings {
  reentry: 'allow' | 'never'
  window: TimeWindow | null
}

export interface Definition {
  subject: SubjectType
  settings: Settings
  triggers: TriggerDef[]
  root: string | null
  nodes: Record<string, NodeDef>
}

export interface Automation {
  id: string
  name: string
  status: AutomationStatus
  draft: Definition
  versionId: string | null
  versionNumber: number | null
  destructive: boolean
  createdAt: string
  updatedAt: string
}

export interface AutomationVersion {
  id: string
  automationId: string
  number: number
  definition: Definition
  publishedAt: string
  publishedBy: string | null
}

export interface AutomationEvent {
  id: string
  type: TriggerType
  subject: { type: SubjectType; id: string | null }
  payload: Record<string, unknown>
  createdAt: string
}

export const RUN_STATUSES = ['active', 'waiting', 'finished', 'failed', 'cancelled'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const STEP_STATUSES = ['ok', 'skipped', 'waiting', 'failed', 'retrying'] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

export const TRIGGER_OUTCOMES = [
  'enrolled',
  'filtered',
  'already_enrolled',
  'paused',
  'loop_limit'
] as const
export type TriggerOutcome = (typeof TRIGGER_OUTCOMES)[number]

export type Origin = 'user' | 'claude' | 'system'

export interface Issue {
  path: string
  message: string
  nodeId?: string
  triggerId?: string
}

export interface Slot {
  parent: string
  port: string
}

export const ROOT = 'root'
export const ROOT_SLOT: Slot = { parent: ROOT, port: ROOT }

export type Scope = Record<string, unknown>

export function emptyDefinition(subject: SubjectType): Definition {
  return {
    subject,
    settings: { reentry: 'allow', window: null },
    triggers: [],
    root: null,
    nodes: {}
  }
}

export function durationMs(amount: number, unit: TimeUnit): number {
  const minute = 60_000
  if (unit === 'minutes') return amount * minute
  if (unit === 'hours') return amount * 60 * minute
  return amount * 24 * 60 * minute
}

export interface Cause {
  runId: string
  automationId: string
  depth: number
  chain: string[]
}

export interface StoredEvent extends AutomationEvent {
  cause: Cause | null
  processedAt: string | null
}

export interface RunWait {
  kind: 'time' | 'condition' | 'window' | 'retry'
  until: string | null
  conditions?: ConditionGroup[]
}

export interface AutomationRun {
  id: string
  automationId: string
  versionId: string
  subjectType: SubjectType
  subjectId: string | null
  triggerId: string | null
  event: AutomationEvent
  status: RunStatus
  nodeId: string | null
  nextAt: string | null
  wait: RunWait | null
  attempts: number
  outputs: Record<string, Record<string, unknown>>
  depth: number
  chain: string[]
  causeRunId: string | null
  late: boolean
  reason: string | null
  origin: Origin
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export interface RunStep {
  id: string
  runId: string
  automationId: string
  nodeId: string
  nodeType: NodeType
  status: StepStatus
  attempt: number
  message: string | null
  output: Record<string, unknown> | null
  startedAt: string
  endedAt: string | null
}

export interface TriggerLogEntry {
  id: string
  automationId: string
  triggerId: string
  eventId: string
  subjectId: string | null
  outcome: TriggerOutcome
  reason: string | null
  createdAt: string
}

export const MAX_DEPTH = 5
export const LOOP_LIMIT = { count: 20, minutes: 30 }
export const RETRY_MINUTES = [1, 5, 30]
export const RETENTION_DAYS = 60
export const MAX_VERSIONS = 10
