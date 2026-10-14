import type { Capability, Edition, SyncTable } from '@shared/edition'
import type { PresenceMember, PresenceView } from '@shared/presence'

export interface SyncPort {
  syncNow(): Promise<{ pushed: number; pulled: number }>

  onRemoteChange(listener: (tables: SyncTable[]) => void): () => void
  stop(): Promise<void>
}

export interface FileSyncPort {
  syncNow(): Promise<{ uploaded: number; downloaded: number; conflicts: number }>
  stop(): Promise<void>
}

export interface Identity {
  userId: string
  email: string
  name: string | null
}

export interface IdentityPort {
  current(): Promise<Identity | null>
  signIn(): Promise<Identity>
  signOut(): Promise<void>

  accessToken(): Promise<string | null>
}

export interface PresencePort {
  announce(view: PresenceView | null, editing: boolean): void
  onChange(listener: (people: PresenceMember[]) => void): () => void
  stop(): Promise<void>
}

export interface EntitlementsPort {
  can(capability: Capability): boolean
  list(): Capability[]
}

export interface CloudAdapters {
  edition: Edition
  sync: SyncPort
  files: FileSyncPort
  identity: IdentityPort
  presence: PresencePort
  entitlements: EntitlementsPort
}
