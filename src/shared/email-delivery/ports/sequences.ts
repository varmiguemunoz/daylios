export type EntryMode = 'event' | 'enrollment'

export type SequenceEntry = { mode: 'event'; event: string } | { mode: 'enrollment' }

export type ThreadMode = 'new' | 'reply'

export interface SequenceStep {
  wait: string
  subject: string
  html: string
  thread?: ThreadMode
  id?: string
  touchId?: string
  templateId?: string
}

export interface SequenceDraft {
  id?: string
  name: string
  from?: string
  entry: SequenceEntry
  steps: SequenceStep[]
  enabled: boolean
}

export interface RemoteSequence {
  id: string
  name: string
  enabled: boolean
  event: string | null
  emails: number
  createdAt: string
  url: string
}

export interface RemoteSequenceStep {
  key: string
  type: string
  wait: string | null
  position?: number
  subject?: string
  html?: string
  thread?: ThreadMode
  touchId?: string
  templateId?: string
}

export interface RemoteSequenceDetail extends RemoteSequence {
  steps: RemoteSequenceStep[]
}

export interface EnrollContact {
  email: string
  firstName?: string | null
  lastName?: string | null
  company?: string | null
}

export interface EnrollRequest {
  contacts: EnrollContact[]
  mailboxIds?: string[]
  labels?: string[]
  paused?: boolean
}

export interface EnrollResult {
  accepted: number
  skipped: number
}

export interface SequenceEngine {
  readonly entryModes: readonly EntryMode[]
  readonly authoring: boolean
  list(): Promise<RemoteSequence[]>
  get(id: string): Promise<RemoteSequenceDetail>
  save(draft: SequenceDraft): Promise<RemoteSequence>
  setEnabled(id: string, enabled: boolean): Promise<RemoteSequence>
  trigger(event: string, email: string, payload?: Record<string, unknown>): Promise<void>
  enroll(id: string, request: EnrollRequest): Promise<EnrollResult>
  archive(id: string): Promise<void>
}
