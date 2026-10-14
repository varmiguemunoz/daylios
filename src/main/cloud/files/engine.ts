import { randomUUID } from 'crypto'
import { existsSync, watch, type FSWatcher } from 'fs'
import { mkdir, rename, stat } from 'fs/promises'
import { dirname } from 'path'
import type { DataSource } from 'typeorm'
import { conflictName, type FileSyncState, type FilesStatus } from '@shared/files'
import { transactionGuard } from '../../guards/transaction.guard'
import { withoutChangeLog } from '../../db/author'
import type { CloudApi } from '../cloud-api'
import { hashFile, scan, toFull, type LocalFile } from './local-files'
import { download, upload, type UploadProgress } from './transfer'

interface ManifestRow {
  id: string
  path: string
  hash: string
  size: number
  mtime: string
  deleted_at: string | null
}

interface StateRow {
  id: string
  path: string
  local_hash: string
  synced_hash: string | null
  size: number
  mtime_ms: number
}

export interface FileEngineDeps {
  db: DataSource
  api: () => CloudApi | null
  orgId: string
  root: string
  recordings: () => boolean
  userName: () => string
  trash: (full: string) => Promise<void>
  onManifestChange: () => void
  onStatus: (status: FilesStatus) => void
}

const CONCURRENCY = 3
const SCAN_MS = 60_000
const DEBOUNCE_MS = 1_000
const MAX_BACKOFF_MS = 60_000

type Job = () => Promise<void>

export class FileSyncEngine {
  private watcher: FSWatcher | null = null
  private interval: NodeJS.Timeout | null = null
  private timer: NodeJS.Timeout | null = null
  private running = false
  private again = false
  private stopped = false
  private failures = 0
  private status: FilesStatus

  constructor(private readonly deps: FileEngineDeps) {
    this.status = { active: true, queued: 0, files: {}, error: null, recordings: deps.recordings() }
  }

  current(): FilesStatus {
    return this.status
  }

  async start(): Promise<void> {
    await mkdir(this.deps.root, { recursive: true })
    try {
      this.watcher = watch(this.deps.root, { recursive: true }, () => this.poke(DEBOUNCE_MS))
    } catch {
      this.watcher = null
    }
    this.interval = setInterval(() => this.poke(0), SCAN_MS)
    this.poke(0)
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.watcher?.close()
    if (this.interval) clearInterval(this.interval)
    if (this.timer) clearTimeout(this.timer)
  }

  poke(delay = DEBOUNCE_MS): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  async syncNow(): Promise<FilesStatus> {
    this.failures = 0
    await this.run()
    return this.status
  }

  setRecordings(on: boolean): void {
    this.set({ recordings: on })
    this.poke(0)
  }

  private async run(): Promise<void> {
    if (this.stopped) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      const api = this.deps.api()
      if (!api) return
      await this.cycle(api)
      this.failures = 0
      this.set({ error: null })
    } catch (e) {
      this.failures++
      this.set({ error: (e as Error).message })
      this.poke(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.failures))
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        this.poke(0)
      }
    }
  }

  private async cycle(api: CloudApi): Promise<void> {
    const local = await scan(this.deps.root, this.status.recordings)
    const manifest: ManifestRow[] = await this.deps.db.query(`SELECT * FROM file_manifest`)
    const alive = new Map(manifest.filter((m) => !m.deleted_at).map((m) => [m.path, m]))
    const states: StateRow[] = await this.deps.db.query(`SELECT * FROM file_state`)
    const byPath = new Map(states.map((s) => [s.path, s]))
    const byId = new Map(states.map((s) => [s.id, s]))
    const jobs: Job[] = []
    const hashes = new Map<string, string>()
    const handled = new Set<string>()

    const localHash = async (file: LocalFile): Promise<string> => {
      const cached = hashes.get(file.path)
      if (cached) return cached
      const st = byPath.get(file.path)
      const hash =
        st && st.size === file.size && st.mtime_ms === file.mtimeMs
          ? st.local_hash
          : await hashFile(toFull(this.deps.root, file.path))
      hashes.set(file.path, hash)
      return hash
    }

    for (const m of manifest) {
      const st = byId.get(m.id)
      if (m.deleted_at) {
        if (!st) continue
        const file = local.get(st.path)
        if (file && (await localHash(file)) === st.synced_hash) {
          await this.deps.trash(toFull(this.deps.root, st.path)).catch(() => undefined)
          local.delete(st.path)
        }
        await this.forgetState(m.id)
        continue
      }
      if (st && st.path !== m.path && local.has(st.path) && !local.has(m.path)) {
        const file = local.get(st.path) as LocalFile
        if ((await localHash(file)) === st.synced_hash) {
          await this.move(st.path, m.path)
          local.delete(st.path)
          const moved = { ...file, path: m.path }
          local.set(m.path, moved)
          hashes.set(m.path, st.synced_hash as string)
          await this.saveState(m.id, m.path, m.hash, st.synced_hash, moved)
        }
      }
      const file = local.get(m.path)
      const current = byId.get(m.id)
      if (!file) {
        if (!current || current.synced_hash !== m.hash || current.path !== m.path) {
          handled.add(m.id)
          jobs.push(() => this.fetch(api, m))
        }
        continue
      }
      const hash = await localHash(file)
      if (hash === m.hash) {
        if (!current || current.synced_hash !== m.hash)
          await this.saveState(m.id, m.path, hash, m.hash, file)
        continue
      }
      const remoteChanged = !current || current.synced_hash !== m.hash
      const localChanged = !current || hash !== current.synced_hash
      handled.add(m.id)
      if (remoteChanged && localChanged) {
        const copy = conflictName(m.path, this.deps.userName(), new Date())
        await this.move(m.path, copy)
        local.delete(m.path)
        this.mark(copy, 'conflict')
        jobs.push(() => this.fetch(api, m))
      } else if (remoteChanged) {
        jobs.push(() => this.fetch(api, m))
      } else {
        jobs.push(() => this.push(api, m.id, m.path, hash, file, false))
      }
    }

    const claimed = new Set(manifest.filter((m) => !m.deleted_at).map((m) => m.path))
    for (const file of local.values()) {
      if (claimed.has(file.path)) continue
      const hash = await localHash(file)
      const moved = [...alive.values()].find(
        (m) =>
          m.hash === hash &&
          !local.has(m.path) &&
          byId.get(m.id)?.synced_hash === hash &&
          !handled.has(m.id)
      )
      if (moved) {
        handled.add(moved.id)
        claimed.add(file.path)
        alive.delete(moved.path)
        await this.writeManifest(moved.id, {
          path: file.path,
          mtime: new Date(file.mtimeMs).toISOString()
        })
        await this.saveState(moved.id, file.path, hash, hash, file)
        continue
      }
      jobs.push(() => this.push(api, randomUUID(), file.path, hash, file, true))
    }

    for (const st of states) {
      if (handled.has(st.id)) continue
      const m = manifest.find((x) => x.id === st.id)
      if (!m || m.deleted_at || local.has(m.path) || st.synced_hash !== m.hash) continue
      if (m.path !== st.path) continue
      await this.writeManifest(m.id, { deleted_at: sqliteNow() })
      await this.forgetState(m.id)
    }

    this.set({ queued: jobs.length })
    await this.drain(jobs)
  }

  private async drain(jobs: Job[]): Promise<void> {
    let index = 0
    let firstError: Error | null = null
    const worker = async (): Promise<void> => {
      while (index < jobs.length) {
        const job = jobs[index++]
        try {
          await job()
        } catch (e) {
          firstError ??= e as Error
        }
        this.set({ queued: Math.max(0, jobs.length - index) })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (firstError) throw firstError
  }

  private async fetch(api: CloudApi, m: ManifestRow): Promise<void> {
    const full = toFull(this.deps.root, m.path)
    this.mark(m.path, 'downloading')
    try {
      await download(api, this.deps.orgId, m.hash, full)
      const s = await stat(full)
      await this.saveState(m.id, m.path, m.hash, m.hash, {
        path: m.path,
        size: s.size,
        mtimeMs: Math.floor(s.mtimeMs)
      })
      this.mark(m.path, 'synced')
    } catch (e) {
      this.mark(m.path, 'error')
      throw e
    }
  }

  private async push(
    api: CloudApi,
    id: string,
    path: string,
    hash: string,
    file: LocalFile,
    fresh: boolean
  ): Promise<void> {
    this.mark(path, 'uploading')
    try {
      await upload(
        api,
        this.deps.orgId,
        toFull(this.deps.root, path),
        hash,
        file.size,
        this.progress()
      )
      const mtime = new Date(file.mtimeMs).toISOString()
      if (fresh) await this.insertManifest({ id, path, hash, size: file.size, mtime })
      else await this.writeManifest(id, { hash, size: file.size, mtime })
      await this.saveState(id, path, hash, hash, file)
      this.mark(path, 'synced')
    } catch (e) {
      this.mark(path, 'error')
      throw e
    }
  }

  private async move(from: string, to: string): Promise<void> {
    const target = toFull(this.deps.root, to)
    if (existsSync(target)) return
    await mkdir(dirname(target), { recursive: true })
    await rename(toFull(this.deps.root, from), target)
  }

  private async insertManifest(row: Omit<ManifestRow, 'deleted_at'>): Promise<void> {
    const now = new Date().toISOString()
    await transactionGuard(this.deps.db, (m) =>
      m.query(
        `INSERT INTO file_manifest (id, path, hash, size, mtime, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.path, row.hash, row.size, row.mtime, now, now]
      )
    )
    this.deps.onManifestChange()
  }

  private async writeManifest(id: string, patch: Partial<Omit<ManifestRow, 'id'>>): Promise<void> {
    const entries = Object.entries({ ...patch, updated_at: new Date().toISOString() })
    await transactionGuard(this.deps.db, (m) =>
      m.query(
        `UPDATE file_manifest SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...entries.map(([, v]) => v), id]
      )
    )
    this.deps.onManifestChange()
  }

  private async saveState(
    id: string,
    path: string,
    localHash: string,
    synced: string | null,
    file: LocalFile
  ): Promise<void> {
    await withoutChangeLog(() =>
      this.deps.db.query(
        `INSERT INTO file_state (id, path, local_hash, synced_hash, size, mtime_ms) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET path = excluded.path, local_hash = excluded.local_hash,
           synced_hash = excluded.synced_hash, size = excluded.size, mtime_ms = excluded.mtime_ms`,
        [id, path, localHash, synced, file.size, file.mtimeMs]
      )
    )
  }

  private async forgetState(id: string): Promise<void> {
    await this.deps.db.query(`DELETE FROM file_state WHERE id = ?`, [id])
  }

  private progress(): UploadProgress {
    const db = this.deps.db
    return {
      get: async (hash) => {
        const rows: { upload_id: string; done: string }[] = await db.query(
          `SELECT upload_id, done FROM file_uploads WHERE hash = ?`,
          [hash]
        )
        return rows[0] ? { uploadId: rows[0].upload_id, done: JSON.parse(rows[0].done) } : null
      },
      save: async (hash, uploadId, done) => {
        await db.query(
          `INSERT INTO file_uploads (hash, upload_id, done) VALUES (?, ?, ?)
           ON CONFLICT(hash) DO UPDATE SET upload_id = excluded.upload_id, done = excluded.done`,
          [hash, uploadId, JSON.stringify(done)]
        )
      },
      clear: async (hash) => {
        await db.query(`DELETE FROM file_uploads WHERE hash = ?`, [hash])
      }
    }
  }

  private mark(path: string, state: FileSyncState): void {
    const files = { ...this.status.files }
    if (state === 'synced') delete files[path]
    else files[path] = state
    this.set({ files })
  }

  private set(patch: Partial<FilesStatus>): void {
    this.status = { ...this.status, ...patch }
    this.deps.onStatus(this.status)
  }
}

const sqliteNow = (): string => new Date().toISOString().replace('T', ' ').slice(0, 19)
