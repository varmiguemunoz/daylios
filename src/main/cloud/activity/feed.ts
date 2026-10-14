import type { DataSource } from 'typeorm'
import type { ActivityEntry, ActivityFilter, ActivityPage, ActivityState } from '@shared/activity'
import type { CloudApi } from '../cloud-api'
import { LocalSyncStore } from '../sync/local-store'

export interface FeedDeps {
  db: DataSource
  api: () => CloudApi | null
  orgId: string
  me: () => string | null
  onNew: (entries: ActivityEntry[]) => void
  onState: (state: ActivityState) => void
}

interface CacheRow {
  id: number
  seq: number
  actor_id: string | null
  verb: ActivityEntry['verb']
  entity: ActivityEntry['entity']
  entity_id: string
  title: string
  detail: string | null
  target_id: string | null
  count: number
  at: string
}

const CURSOR = 'activity_cursor'
const SEEN = 'activity_seen'
const POLL_MS = 60_000
const LIST_MAX = 500

const toEntry = (r: CacheRow): ActivityEntry => ({
  id: r.id,
  seq: r.seq,
  actorId: r.actor_id,
  verb: r.verb,
  entity: r.entity,
  entityId: r.entity_id,
  title: r.title,
  detail: r.detail,
  targetId: r.target_id,
  count: r.count,
  at: r.at
})

export class ActivityFeed {
  private readonly store: LocalSyncStore
  private timer: NodeJS.Timeout | null = null
  private running: Promise<void> | null = null
  private again = false
  private stopped = false

  constructor(private readonly deps: FeedDeps) {
    this.store = new LocalSyncStore(deps.db)
  }

  async start(): Promise<void> {
    await this.pull().catch(() => undefined)
    this.timer = setInterval(() => this.poke(), POLL_MS)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.running?.catch(() => undefined)
  }

  poke(): void {
    if (this.stopped) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = this.pull()
      .catch(() => undefined)
      .finally(() => {
        this.running = null
        if (this.again) {
          this.again = false
          this.poke()
        }
      })
  }

  async pull(): Promise<void> {
    const api = this.deps.api()
    if (!api) return
    const first = (await this.store.get(CURSOR)) === null
    const fresh: ActivityEntry[] = []
    for (;;) {
      const since = await this.store.number(CURSOR)
      const page = await api.call<ActivityPage>(
        'GET',
        `/activity/${this.deps.orgId}?since=${since}`
      )
      for (const e of page.items) {
        if (await this.save(e)) fresh.push(e)
      }
      await this.store.set(CURSOR, String(page.cursor))
      if (!page.more) break
    }
    if (first) await this.store.set(SEEN, String(await this.store.number(CURSOR)))
    else if (fresh.length) this.deps.onNew(fresh)
    this.deps.onState(await this.state())
  }

  private async save(e: ActivityEntry): Promise<boolean> {
    const known: { count: number }[] = await this.deps.db.query(
      `SELECT count FROM activity_cache WHERE id = ?`,
      [e.id]
    )
    await this.deps.db.query(
      `INSERT INTO activity_cache (id, seq, actor_id, verb, entity, entity_id, title, detail, target_id, count, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET seq = excluded.seq, title = excluded.title,
         detail = excluded.detail, count = excluded.count, at = excluded.at`,
      [
        e.id,
        e.seq,
        e.actorId,
        e.verb,
        e.entity,
        e.entityId,
        e.title,
        e.detail,
        e.targetId,
        e.count,
        e.at
      ]
    )
    return !known.length
  }

  async state(): Promise<ActivityState> {
    const seen = await this.store.number(SEEN)
    const me = this.deps.me()
    const rows: { n: number }[] = await this.deps.db.query(
      `SELECT count(*) AS n FROM activity_cache WHERE seq > ? AND (actor_id IS NULL OR actor_id <> ?)`,
      [seen, me ?? '']
    )
    return { enabled: true, unseen: Number(rows[0]?.n ?? 0) }
  }

  async markSeen(): Promise<ActivityState> {
    const rows: { seq: number | null }[] = await this.deps.db.query(
      `SELECT max(seq) AS seq FROM activity_cache`
    )
    await this.store.set(SEEN, String(rows[0]?.seq ?? 0))
    const state = await this.state()
    this.deps.onState(state)
    return state
  }

  async list(filter: ActivityFilter = {}): Promise<ActivityEntry[]> {
    const where: string[] = []
    const args: unknown[] = []
    const add = (sql: string, value: unknown): void => {
      where.push(sql)
      args.push(value)
    }
    if (filter.actorId) add('actor_id = ?', filter.actorId)
    if (filter.verb) add('verb = ?', filter.verb)
    if (filter.entity) add('entity = ?', filter.entity)
    if (filter.entityId) add('entity_id = ?', filter.entityId)
    const limit = Math.min(Math.max(Number(filter.limit) || 200, 1), LIST_MAX)
    const rows: CacheRow[] = await this.deps.db.query(
      `SELECT * FROM activity_cache ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY at DESC, id DESC LIMIT ?`,
      [...args, limit]
    )
    return rows.map(toEntry)
  }
}
