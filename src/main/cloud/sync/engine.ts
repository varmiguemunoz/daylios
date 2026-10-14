import { existsSync, readFileSync, rmSync } from 'fs'
import type { DataSource } from 'typeorm'
import { SYNC_TABLES } from '@shared/edition'
import { decodeHlc, encodeHlc, receive, type Hlc } from '@shared/hlc'
import { stateToMutations, type Mutation } from '@shared/sync-merge'
import {
  CHANGE_EVENT,
  MAX_PUSH_BATCH,
  groupChanges,
  realtimeChannel,
  type BootstrapResponse,
  type ChangeNotice,
  type PullResponse,
  type PushResponse,
  type RemoteChange,
  type RemoteDeletion,
  type SyncMutation,
  type SyncStatus
} from '@shared/sync-protocol'
import { transactionGuard } from '../../guards/transaction.guard'
import { withoutChangeLog } from '../../db/author'
import type { CloudApi } from '../cloud-api'
import { applyIncoming, type LocalFill } from './incoming'
import { LocalSyncStore, quoteIdent as q } from './local-store'
import { buildOutgoing, snapshotPage, type OutgoingRev } from './outgoing'

export type InitMode = 'seed' | 'join'

export interface EngineDeps {
  db: DataSource
  api: () => CloudApi | null
  orgId: string
  deviceId: string
  markerFile: string
  notify: (changes?: RemoteChange[]) => void
  subscribe: (topic: string, event: string, cb: (payload: unknown) => void) => () => void
  fill: LocalFill
  onStatus: (status: SyncStatus) => void
}

const DEBOUNCE_MS = 300
const TICK_MS = 30_000
const MAX_BACKOFF_MS = 60_000
const SEED_PAGE = 200
const OFFLINE = /conexión/i

export class SyncEngine {
  private readonly store: LocalSyncStore
  private timer: NodeJS.Timeout | null = null
  private interval: NodeJS.Timeout | null = null
  private running = false
  private again = false
  private stopped = false
  private failures = 0
  private unsubscribe: (() => void) | null = null
  private status: SyncStatus = {
    phase: 'syncing',
    pending: 0,
    lastPushAt: null,
    lastPullAt: null,
    error: null,
    bootstrap: null,
    deletedByOthers: []
  }

  constructor(private readonly deps: EngineDeps) {
    this.store = new LocalSyncStore(deps.db)
  }

  current(): SyncStatus {
    return this.status
  }

  async start(): Promise<void> {
    await this.applyMarker()
    if ((await this.store.get('paused')) === '1') this.set({ phase: 'paused' })
    this.unsubscribe = this.deps.subscribe(
      realtimeChannel(this.deps.orgId),
      CHANGE_EVENT,
      (payload) => {
        const cursor = Number((payload as ChangeNotice | null)?.cursor ?? 0)
        void this.store.number('cursor').then((mine) => cursor > mine && this.poke())
      }
    )
    this.interval = setInterval(() => this.poke(), TICK_MS)
    this.poke()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    if (this.interval) clearInterval(this.interval)
    this.unsubscribe?.()
  }

  poke(delay = DEBOUNCE_MS): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  async syncNow(): Promise<SyncStatus> {
    this.failures = 0
    await this.run()
    return this.status
  }

  async pause(paused: boolean): Promise<SyncStatus> {
    await this.store.set('paused', paused ? '1' : null)
    if (paused) return this.set({ phase: 'paused' })
    this.set({ phase: 'syncing' })
    return this.syncNow()
  }

  async redownload(): Promise<SyncStatus> {
    await this.store.set('bootstrapped', null)
    await this.store.set('cursor', '0')
    return this.syncNow()
  }

  async restore(entity: string, id: string): Promise<SyncStatus> {
    if (!(SYNC_TABLES as readonly string[]).includes(entity)) return this.status
    const where = await this.store.keyWhere(entity as (typeof SYNC_TABLES)[number], id)
    await transactionGuard(this.deps.db, (m) =>
      m.query(`UPDATE ${q(entity)} SET deleted_at = NULL WHERE ${where.sql}`, where.params)
    )
    this.deps.notify()
    this.set({
      deletedByOthers: this.status.deletedByOthers.filter(
        (d) => !(d.entity === entity && d.id === id)
      )
    })
    this.poke(0)
    return this.status
  }

  private async run(): Promise<void> {
    if (this.stopped) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      if ((await this.store.get('paused')) === '1') {
        this.set({ phase: 'paused', pending: await this.pending() })
        return
      }
      const api = this.deps.api()
      if (!api) {
        this.set({ phase: 'error', error: 'Inicia sesión para sincronizar.' })
        return
      }
      this.set({ phase: 'syncing' })
      if ((await this.store.get('seed')) === '1') await this.seed(api)
      if ((await this.store.get('bootstrapped')) !== '1') await this.bootstrap(api)
      await this.push(api)
      await this.pull(api)
      this.failures = 0
      this.set({ phase: 'synced', error: null, pending: await this.pending() })
    } catch (e) {
      const message = (e as Error).message
      this.failures++
      this.set({
        phase: OFFLINE.test(message) ? 'offline' : 'error',
        error: OFFLINE.test(message) ? null : message,
        pending: await this.pending().catch(() => this.status.pending)
      })
      this.poke(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.failures))
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        this.poke()
      }
    }
  }

  private async pending(): Promise<number> {
    return this.store.pendingCount(await this.store.number('last_pushed'))
  }

  private async hlc(): Promise<Hlc> {
    const saved = await this.store.get('hlc')
    return saved
      ? { ...decodeHlc(saved), node: this.deps.deviceId }
      : { ms: 0, counter: 0, node: this.deps.deviceId }
  }

  private async send(
    api: CloudApi,
    mutations: SyncMutation[],
    revs: OutgoingRev[],
    quiet = false
  ): Promise<void> {
    if (!mutations.length) return
    const res = await api.call<PushResponse>('POST', '/sync/push', {
      orgId: this.deps.orgId,
      deviceId: this.deps.deviceId,
      mutations,
      ...(quiet ? { quiet } : {})
    })
    const rejected = new Set(res.rejected.map((r) => r.mutationId))
    const ok = new Set(
      mutations
        .filter((m) => !rejected.has(m.mutationId))
        .map((m) => `${m.entity}\u0001${m.id}\u0001${m.rev}`)
    )
    for (const r of revs) {
      if (ok.has(`${r.entity}\u0001${r.id}\u0001${r.rev}`))
        await this.store.setRevs(r.entity, r.id, r.fields, r.rev)
    }
    if (res.rejected.length) this.set({ error: res.rejected[0].reason })
    this.set({ lastPushAt: new Date().toISOString() })
  }

  private async push(api: CloudApi): Promise<void> {
    for (;;) {
      const after = await this.store.number('last_pushed')
      const rows = await this.store.pending(after, MAX_PUSH_BATCH)
      if (!rows.length) return
      const out = await buildOutgoing(rows, this.store, this.deps.deviceId, await this.hlc())
      await this.send(api, out.mutations, out.revs)
      await this.store.set('hlc', encodeHlc(out.hlc))
      await this.store.set('last_pushed', String(out.lastSeq))
    }
  }

  private async seed(api: CloudApi): Promise<void> {
    const start = await this.store.maxSeq()
    let hlc = await this.hlc()
    for (const table of SYNC_TABLES) {
      for (let offset = 0; ; offset += SEED_PAGE) {
        const page = await snapshotPage(this.store, table, offset, SEED_PAGE, hlc)
        hlc = page.hlc
        await this.send(api, page.mutations, page.revs, true)
        if (page.count < SEED_PAGE) break
      }
    }
    await this.store.set('hlc', encodeHlc(hlc))
    await this.store.set(
      'last_pushed',
      String(Math.max(start, await this.store.number('last_pushed')))
    )
    await this.store.set('seed', null)
  }

  private async bootstrap(api: CloudApi): Promise<void> {
    let after: string | null = null
    let cursor: number | null = null
    let done = 0
    do {
      const query: string = after ? `?after=${encodeURIComponent(after)}` : ''
      const page: BootstrapResponse = await api.call<BootstrapResponse>(
        'GET',
        `/sync/${this.deps.orgId}/bootstrap${query}`
      )
      cursor ??= page.cursor
      const mutations = page.records.flatMap((r) => stateToMutations(r.entity, r.state))
      await this.apply(mutations)
      done += page.records.length
      this.set({ bootstrap: { done, total: page.total } })
      after = page.after
    } while (after)
    await this.store.set('cursor', String(cursor ?? 0))
    await this.store.set('bootstrapped', '1')
    this.set({ bootstrap: null })
  }

  private async pull(api: CloudApi): Promise<void> {
    for (;;) {
      const since = await this.store.number('cursor')
      const res = await api.call<PullResponse>(
        'GET',
        `/sync/${this.deps.orgId}/pull?since=${since}`
      )
      const remote = res.mutations
      if (remote.length) {
        const latest = remote.reduce((max, m) => (m.rev > max ? m.rev : max), '')
        if (latest) {
          const merged = receive(await this.hlc(), decodeHlc(latest), Date.now())
          await this.store.set('hlc', encodeHlc(merged))
        }
        await this.apply(remote, res.cursor)
      } else {
        await this.store.set('cursor', String(res.cursor))
      }
      this.set({ lastPullAt: new Date().toISOString() })
      if (!res.more) return
    }
  }

  private async apply(mutations: Mutation[], cursor?: number): Promise<void> {
    if (!mutations.length && cursor === undefined) return
    const result = await transactionGuard(this.deps.db, (manager) =>
      withoutChangeLog(async () => {
        const applied = await applyIncoming(manager, this.store, mutations, this.deps.fill)
        if (cursor !== undefined) await this.store.set('cursor', String(cursor), manager)
        return applied
      })
    )
    if (result.touched.size) this.deps.notify(groupChanges(mutations))
    if (result.deletions.length) this.remember(result.deletions)
  }

  private remember(list: RemoteDeletion[]): void {
    this.set({ deletedByOthers: [...list, ...this.status.deletedByOthers].slice(0, 20) })
  }

  private async applyMarker(): Promise<void> {
    if (!existsSync(this.deps.markerFile)) return
    let mode: InitMode | null = null
    try {
      mode =
        (JSON.parse(readFileSync(this.deps.markerFile, 'utf8')) as { mode?: InitMode }).mode ?? null
    } catch {
      mode = null
    }
    await this.store.resetSync()
    if (mode === 'join') {
      await transactionGuard(this.deps.db, (m) =>
        withoutChangeLog(async () => {
          await m.query(`DELETE FROM pipeline_stages`)
          await m.query(`DELETE FROM pipelines`)
          await m.query(`DELETE FROM dashboards`)
        })
      )
    }
    await this.store.set('last_pushed', String(await this.store.maxSeq()))
    if (mode === 'seed') {
      await this.store.set('seed', '1')
      await this.store.set('bootstrapped', '1')
    }
    rmSync(this.deps.markerFile, { force: true })
  }

  private set(patch: Partial<SyncStatus>): SyncStatus {
    this.status = { ...this.status, ...patch }
    this.deps.onStatus(this.status)
    return this.status
  }
}
