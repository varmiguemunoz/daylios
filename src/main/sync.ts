import { cpSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { CLIENTS_FOLDER, clientFolderFor, ensureClientFolder, isInside } from './services/documents'
import type { DataSource } from 'typeorm'
import type { LocalSummary, RemoteChange, SyncStatus } from '@shared/sync-protocol'
import type { SyncTable } from '@shared/edition'
import type { Account } from './account'
import type { SyncEngine } from './cloud/sync/engine'

export const SYNC_MARKER = 'sync-init.json'

const OFF: SyncStatus = {
  phase: 'off',
  pending: 0,
  lastPushAt: null,
  lastPullAt: null,
  error: null,
  bootstrap: null,
  deletedByOthers: []
}

interface SyncDeps {
  db: DataSource
  account: Account
  dataRoot: string
  workspacePath: () => string
  activeOrg: () => { id: string; name: string } | null
  deviceId: () => string
  notify: (changes?: RemoteChange[]) => void
  onStatus: (status: SyncStatus) => void
}

export class Sync {
  private engine: SyncEngine | null = null

  constructor(private readonly deps: SyncDeps) {
    deps.account.onChange(() => void this.refresh())
  }

  status(): SyncStatus {
    return this.engine?.current() ?? OFF
  }

  poke(): void {
    this.engine?.poke()
  }

  async refresh(): Promise<void> {
    const org = this.deps.activeOrg()
    const ready = !!org && !!this.deps.account.cloudApi()
    if (!ready) {
      if (this.engine) {
        await this.engine.stop()
        this.engine = null
        this.deps.onStatus(OFF)
      }
      return
    }
    if (this.engine) return
    await this.relocateClientFolders().catch(() => undefined)
    const { SyncEngine } = await import('./cloud/sync/engine')
    this.engine = new SyncEngine({
      db: this.deps.db,
      api: () => this.deps.account.cloudApi(),
      orgId: org.id,
      deviceId: this.deps.deviceId(),
      markerFile: join(this.deps.dataRoot, SYNC_MARKER),
      notify: this.deps.notify,
      subscribe: (topic, event, cb) => this.deps.account.subscribe(topic, event, cb),
      fill: (table, row) => this.fill(table, row),
      onStatus: this.deps.onStatus
    })
    await this.engine.start()
  }

  syncNow(): Promise<SyncStatus> {
    return this.engine?.syncNow() ?? Promise.resolve(OFF)
  }

  pause(paused: boolean): Promise<SyncStatus> {
    return this.engine?.pause(paused) ?? Promise.resolve(OFF)
  }

  redownload(): Promise<SyncStatus> {
    return this.engine?.redownload() ?? Promise.resolve(OFF)
  }

  restore(entity: string, id: string): Promise<SyncStatus> {
    return this.engine?.restore(entity, id) ?? Promise.resolve(OFF)
  }

  async localSummary(): Promise<LocalSummary> {
    const { LocalSyncStore } = await import('./cloud/sync/local-store')
    const tables = (await new LocalSyncStore(this.deps.db).counts()).filter((t) => t.rows > 0)
    return { tables, total: tables.reduce((n, t) => n + t.rows, 0) }
  }

  async stop(): Promise<void> {
    await this.engine?.stop()
  }

  private async relocateClientFolders(): Promise<void> {
    const marker = join(this.deps.dataRoot, SYNC_MARKER)
    if (!existsSync(marker)) return
    const mode = (JSON.parse(readFileSync(marker, 'utf8')) as { mode?: string }).mode
    if (mode !== 'seed') return
    const workspace = this.deps.workspacePath()
    const clients = join(workspace, CLIENTS_FOLDER)
    const { withoutChangeLog } = await import('./db/author')
    const rows: { id: string; name: string; folder_path: string }[] = await this.deps.db.query(
      `SELECT id, name, folder_path FROM clients`
    )
    for (const row of rows) {
      if (isInside(clients, row.folder_path)) continue
      const target = clientFolderFor(workspace, row.name)
      if (existsSync(row.folder_path) && !existsSync(target)) {
        cpSync(row.folder_path, target, { recursive: true })
      }
      await ensureClientFolder(target)
      await withoutChangeLog(() =>
        this.deps.db.query(`UPDATE clients SET folder_path = ? WHERE id = ?`, [target, row.id])
      )
    }
  }

  private async fill(
    table: SyncTable,
    row: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (table !== 'clients' || row.folder_path) return {}
    const folder = clientFolderFor(this.deps.workspacePath(), String(row.name ?? 'Cliente'))
    await ensureClientFolder(folder).catch(() => undefined)
    return { folder_path: folder }
  }
}
