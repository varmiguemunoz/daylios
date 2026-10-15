import type {
  Automation,
  AutomationRun,
  AutomationStatus,
  Definition,
  Issue,
  NodeType,
  RunStatus,
  RunStep,
  StepStatus,
  SubjectType,
  TriggerLogEntry
} from './model'
import type { RefTarget } from './validate'

export interface AutomationSummary {
  id: string
  name: string
  subject: SubjectType
  status: AutomationStatus
  versionNumber: number | null
  destructive: boolean
  sentence: string
  issues: number
  hasDraftChanges: boolean
  counts: {
    active: number
    waiting: number
    finished: number
    failed: number
    failedRecent: number
  }
  updatedAt: string
}

export interface AutomationDetail {
  automation: Automation
  issues: Issue[]
  hasDraftChanges: boolean
}

export interface VersionBrief {
  id: string
  number: number
  publishedAt: string
  publishedBy: string | null
  current: boolean
}

export interface RunView extends AutomationRun {
  subjectLabel: string | null
  nodeName: string | null
  automationName: string
}

export interface RunDetail {
  run: RunView
  steps: RunStep[]
}

export interface RunFilter {
  automationId?: string
  subjectId?: string
  status?: RunStatus
  limit?: number
  offset?: number
}

export interface StepFilter {
  automationId: string
  nodeId?: string
  status?: StepStatus
  limit?: number
}

export type NodeStats = Record<
  string,
  { ok: number; skipped: number; failed: number; waitingHere: number; failedHere: number }
>

export interface TestStep {
  nodeId: string
  type: NodeType
  name: string
  sentence: string
  rendered: Record<string, string>
  port: string | null
  note: string | null
}

export interface TestResult {
  subjectLabel: string | null
  matchedTrigger: boolean
  steps: TestStep[]
}

export interface Option {
  id: string
  name: string
}

export interface AutomationOptions {
  tags: Option[]
  pipelines: Option[]
  stages: (Option & { pipelineId: string })[]
  clients: Option[]
  projects: (Option & { clientId: string })[]
}

export interface SubjectOption {
  id: string
  label: string
  hint: string | null
}

export interface AutomationsApi {
  list(): Promise<AutomationSummary[]>
  get(id: string): Promise<AutomationDetail>
  create(input: { name: string; subject: SubjectType }): Promise<AutomationDetail>
  rename(id: string, name: string): Promise<AutomationDetail>
  saveDraft(id: string, definition: Definition): Promise<AutomationDetail>
  publish(id: string, options?: { acknowledgeDestructive?: boolean }): Promise<AutomationDetail>
  versions(id: string): Promise<VersionBrief[]>
  restore(id: string, versionId: string): Promise<AutomationDetail>
  setStatus(id: string, status: 'active' | 'paused'): Promise<AutomationDetail>
  remove(id: string): Promise<void>
  runs(filter: RunFilter): Promise<RunView[]>
  run(id: string): Promise<RunDetail>
  steps(filter: StepFilter): Promise<RunStep[]>
  triggerLog(automationId: string, limit?: number): Promise<TriggerLogEntry[]>
  stats(automationId: string): Promise<NodeStats>
  cancel(runId: string): Promise<RunView>
  resume(runId: string): Promise<RunView>
  retry(runId: string): Promise<RunView>
  retryNode(automationId: string, nodeId: string): Promise<number>
  test(input: {
    id?: string
    definition?: Definition
    subjectId: string | null
  }): Promise<TestResult>
  runManual(id: string, subjectId: string | null): Promise<void>
  references(kind: RefTarget, value: string): Promise<{ id: string; name: string }[]>
  options(): Promise<AutomationOptions>
  subjects(type: SubjectType, query: string): Promise<SubjectOption[]>
}

export type AutomationsBridge = AutomationsApi & { onChanged(cb: () => void): () => void }

const WRITE: Record<keyof AutomationsApi, boolean> = {
  list: false,
  get: false,
  versions: false,
  runs: false,
  run: false,
  steps: false,
  triggerLog: false,
  stats: false,
  test: false,
  references: false,
  options: false,
  subjects: false,
  create: true,
  rename: true,
  saveDraft: true,
  publish: true,
  restore: true,
  setStatus: true,
  remove: true,
  cancel: true,
  resume: true,
  retry: true,
  retryNode: true,
  runManual: true
}

export const AUTOMATION_METHODS = Object.keys(WRITE) as (keyof AutomationsApi)[]

export const isAutomationWrite = (method: keyof AutomationsApi): boolean => WRITE[method]
