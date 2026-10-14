import type { TasksApi } from '../shared/tasks'
import type { Note, NotesApi, VoiceResult } from '../shared/notes'
import type { ConsultoraApi, Meeting, StopInfo } from '../shared/consultora'
import type { MarketingApi } from '../shared/marketing'
import type { WorkspaceApi } from '../shared/workspace'
import type { UiStateApi } from '../shared/ui-state'
import type { DashboardApi } from '../shared/metrics'
import type { EditionApi } from '../shared/edition'
import type { AccountApi } from '../shared/account'
import type { OrgsApi } from '../shared/organizations'
import type { SyncApi } from '../shared/sync-protocol'
import type { FilesApi } from '../shared/files'
import type { ActivityApi } from '../shared/activity'
import type { PresenceApi } from '../shared/presence'
import type { RemoteChange } from '../shared/sync-protocol'

declare global {
  interface Window {
    api: {
      ui: UiStateApi
      tasks: TasksApi

      dashboard: DashboardApi

      edition: EditionApi
      account: AccountApi
      orgs: OrgsApi
      sync: SyncApi
      files: FilesApi
      activity: ActivityApi
      presence: PresenceApi
      notes: NotesApi
      workspace: WorkspaceApi
      consultora: ConsultoraApi
      marketing: MarketingApi
      recording: {
        start: () => Promise<Meeting>
        chunk: (id: string, data: Uint8Array) => Promise<void>
        stop: (id: string, info: StopInfo) => Promise<Meeting>
      }
      permissions: {
        check: () => Promise<{ screen: string; microphone: string; accessibility: boolean }>
        open: (kind: 'screen' | 'microphone' | 'accessibility') => Promise<void>
        restartApp: () => Promise<void>
      }
      voice: {
        onStart: (cb: () => void) => () => void
        onStop: (cb: () => void) => () => void
        finish: (data: Uint8Array, seconds: number) => Promise<VoiceResult>
        hide: () => void
      }

      onNotesOpen: (cb: (note: Note) => void) => () => void
      hideWindow: () => void

      setWorkspaceActive: (on: boolean) => void

      openConsultora: (target?: { client?: string; workspace?: boolean }) => void

      onConsultoraNavigate: (
        cb: (target: {
          client?: string
          workspace?: boolean
          account?: boolean
          open?: { entity: string; id: string }
        }) => void
      ) => () => void

      openPath: (path: string) => Promise<void>

      pathForFile: (file: File) => string

      onWindowShown: (cb: () => void) => () => void

      onDataChanged: (cb: () => void) => () => void

      onRemoteChanges: (cb: (changes: RemoteChange[]) => void) => () => void
    }
  }
}
