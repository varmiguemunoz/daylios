import type { Capability } from './edition'
import type { Mutation, RecordState } from './sync-merge'

export const SYNC_PROTOCOL_VERSION = 1
export const MIN_CLIENT_PROTOCOL = 1
export const PROTOCOL_HEADER = 'x-daylios-protocol'

export const MAX_PUSH_BATCH = 500
export const PULL_PAGE = 500
export const BOOTSTRAP_PAGE = 500

export interface SyncMutation extends Mutation {
  mutationId: string
}

export interface PushRequest {
  orgId: string
  deviceId: string
  mutations: SyncMutation[]
  quiet?: boolean
}

export interface PushResponse {
  cursor: number
  applied: number
  rejected: { mutationId: string; reason: string }[]
}

export interface PulledMutation extends Mutation {
  cursor: number
  by: string | null
}

export interface PullResponse {
  mutations: PulledMutation[]
  cursor: number
  more: boolean
}

export interface BootstrapRecord {
  entity: string
  state: RecordState
}

export interface BootstrapResponse {
  records: BootstrapRecord[]
  after: string | null
  cursor: number
  total: number
}

export interface ChangeNotice {
  cursor: number
}

export const CHANGE_EVENT = 'changes'

export interface RemoteChange {
  entity: string
  ids: string[]
}

export function groupChanges(list: { entity: string; id: string }[]): RemoteChange[] {
  const map = new Map<string, Set<string>>()
  for (const m of list) map.set(m.entity, (map.get(m.entity) ?? new Set()).add(m.id))
  return [...map.entries()].map(([entity, ids]) => ({ entity, ids: [...ids].slice(0, 200) }))
}

export interface EntitlementsResponse {
  orgId: string
  capabilities: Capability[]
  limits: { members: number }
  validUntil: string
}

export interface HealthResponse {
  ok: true
  version: string
  protocol: number
}

export const realtimeChannel = (orgId: string): string => `org:${orgId}`

export type SyncPhase = 'off' | 'synced' | 'syncing' | 'offline' | 'paused' | 'error'

export interface RemoteDeletion {
  entity: string
  id: string
  at: string
}

export interface SyncStatus {
  phase: SyncPhase
  pending: number
  lastPushAt: string | null
  lastPullAt: string | null
  error: string | null
  bootstrap: { done: number; total: number } | null
  deletedByOthers: RemoteDeletion[]
}

export interface LocalSummary {
  tables: { entity: string; rows: number }[]
  total: number
}

export interface SyncApi {
  status(): Promise<SyncStatus>
  syncNow(): Promise<SyncStatus>
  pause(paused: boolean): Promise<SyncStatus>
  redownload(): Promise<SyncStatus>
  restore(entity: string, id: string): Promise<SyncStatus>
  localSummary(): Promise<LocalSummary>
  onStatus(cb: (status: SyncStatus) => void): () => void
}
