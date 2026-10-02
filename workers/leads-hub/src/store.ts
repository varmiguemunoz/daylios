import type { HubConfig, HubItem } from '../../../src/shared/hub'

/** Persistencia del Worker: la config que empuja la app y la cola para la app. */
export interface HubStore {
  getConfig(): Promise<HubConfig>
  /** Reemplaza fuentes y reglas; fusiona el mapa de segments (nunca pierde ids). */
  putConfig(config: HubConfig): Promise<HubConfig>
  mergeSegments(segments: Record<string, string>): Promise<void>
  enqueue(item: HubItem): Promise<void>
  /** Items en orden de llegada. */
  list(limit: number): Promise<HubItem[]>
  ack(ids: string[]): Promise<number>
  count(): Promise<number>
}

export const EMPTY_CONFIG: HubConfig = { sources: [], rules: [], segments: {} }

/** D1 (SQLite de Cloudflare). Esquema en schema.sql. */
export class D1Store implements HubStore {
  constructor(private readonly db: D1Database) {}

  async getConfig(): Promise<HubConfig> {
    const row = await this.db
      .prepare(`SELECT value FROM config WHERE key = 'hub'`)
      .first<{ value: string }>()
    return row ? { ...EMPTY_CONFIG, ...(JSON.parse(row.value) as HubConfig) } : { ...EMPTY_CONFIG }
  }

  private async save(config: HubConfig): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO config (key, value) VALUES ('hub', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .bind(JSON.stringify(config))
      .run()
  }

  async putConfig(config: HubConfig): Promise<HubConfig> {
    const current = await this.getConfig()
    const next = { ...config, segments: { ...current.segments, ...config.segments } }
    await this.save(next)
    return next
  }

  async mergeSegments(segments: Record<string, string>): Promise<void> {
    if (!Object.keys(segments).length) return
    const current = await this.getConfig()
    await this.save({ ...current, segments: { ...current.segments, ...segments } })
  }

  async enqueue(item: HubItem): Promise<void> {
    await this.db
      .prepare(`INSERT INTO inbox (id, kind, payload, created_at) VALUES (?, ?, ?, ?)`)
      .bind(item.id, item.kind, JSON.stringify(item), item.receivedAt)
      .run()
  }

  async list(limit: number): Promise<HubItem[]> {
    const { results } = await this.db
      .prepare(`SELECT payload FROM inbox ORDER BY created_at ASC, rowid ASC LIMIT ?`)
      .bind(limit)
      .all<{ payload: string }>()
    return results.map((r) => JSON.parse(r.payload) as HubItem)
  }

  async ack(ids: string[]): Promise<number> {
    if (!ids.length) return 0
    const marks = ids.map(() => '?').join(',')
    const res = await this.db
      .prepare(`DELETE FROM inbox WHERE id IN (${marks})`)
      .bind(...ids)
      .run()
    return res.meta.changes ?? 0
  }

  async count(): Promise<number> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS n FROM inbox`).first<{ n: number }>()
    return row?.n ?? 0
  }
}

/** Store en memoria (tests y `wrangler dev` sin D1). */
export class MemoryStore implements HubStore {
  config: HubConfig = { ...EMPTY_CONFIG, segments: {} }
  items: HubItem[] = []

  async getConfig(): Promise<HubConfig> {
    return structuredClone(this.config)
  }
  async putConfig(config: HubConfig): Promise<HubConfig> {
    this.config = {
      ...structuredClone(config),
      segments: { ...this.config.segments, ...config.segments }
    }
    return this.getConfig()
  }
  async mergeSegments(segments: Record<string, string>): Promise<void> {
    this.config.segments = { ...this.config.segments, ...segments }
  }
  async enqueue(item: HubItem): Promise<void> {
    this.items.push(structuredClone(item))
  }
  async list(limit: number): Promise<HubItem[]> {
    return structuredClone(this.items.slice(0, limit))
  }
  async ack(ids: string[]): Promise<number> {
    const before = this.items.length
    this.items = this.items.filter((i) => !ids.includes(i.id))
    return before - this.items.length
  }
  async count(): Promise<number> {
    return this.items.length
  }
}
