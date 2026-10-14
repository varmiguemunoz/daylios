import type { FilesStatus, TrashedFile, UsageResponse } from '@shared/files'
import type { Account } from './account'
import type { FileSyncEngine } from './cloud/files/engine'
import type { DataSource } from 'typeorm'

interface FilesDeps {
  db: DataSource
  account: Account
  root: () => string
  activeOrg: () => { id: string; name: string } | null
  recordings: () => boolean
  saveRecordings: (on: boolean) => void
  trash: (full: string) => Promise<void>
  onManifestChange: () => void
  onStatus: (status: FilesStatus) => void
}

const OFF = (recordings: boolean): FilesStatus => ({
  active: false,
  queued: 0,
  files: {},
  error: null,
  recordings
})

export class Files {
  private engine: FileSyncEngine | null = null

  constructor(private readonly deps: FilesDeps) {
    deps.account.onChange(() => void this.refresh())
  }

  status(): FilesStatus {
    return this.engine?.current() ?? OFF(this.deps.recordings())
  }

  poke(): void {
    this.engine?.poke()
  }

  async refresh(): Promise<void> {
    const org = this.deps.activeOrg()
    if (!org || !this.deps.account.cloudApi()) {
      if (this.engine) {
        await this.engine.stop()
        this.engine = null
        this.deps.onStatus(OFF(this.deps.recordings()))
      }
      return
    }
    if (this.engine) return
    const { FileSyncEngine } = await import('./cloud/files/engine')
    this.engine = new FileSyncEngine({
      db: this.deps.db,
      api: () => this.deps.account.cloudApi(),
      orgId: org.id,
      root: this.deps.root(),
      recordings: this.deps.recordings,
      userName: () => {
        const user = this.deps.account.current().user
        return user?.name ?? user?.email ?? 'otra persona'
      },
      trash: this.deps.trash,
      onManifestChange: this.deps.onManifestChange,
      onStatus: this.deps.onStatus
    })
    await this.engine.start()
  }

  async usage(): Promise<UsageResponse | null> {
    const org = this.deps.activeOrg()
    const api = this.deps.account.cloudApi()
    if (!org || !api) return null
    return api.call<UsageResponse>('GET', `/files/${org.id}/usage`)
  }

  setRecordings(on: boolean): FilesStatus {
    this.deps.saveRecordings(on)
    this.engine?.setRecordings(on)
    return this.status()
  }

  syncNow(): Promise<FilesStatus> {
    return this.engine?.syncNow() ?? Promise.resolve(this.status())
  }

  async trash(): Promise<TrashedFile[]> {
    if (!this.deps.activeOrg()) return []
    const rows: { id: string; path: string; deleted_at: string }[] = await this.deps.db.query(
      `SELECT id, path, deleted_at FROM file_manifest WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`
    )
    return rows.map((r) => ({ id: r.id, path: r.path, deletedAt: r.deleted_at }))
  }

  async stop(): Promise<void> {
    await this.engine?.stop()
  }
}
