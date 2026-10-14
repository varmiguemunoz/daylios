import type { DataSource, EntityManager } from 'typeorm'
import { NEVER_SYNC, SYNC_TABLES, isRecordSynced, type SyncTable } from '@shared/edition'

export interface ChangeRow {
  seq: number
  entity: string
  entity_id: string
  op: 'insert' | 'update' | 'delete' | 'restore' | 'purge'
  fields: string | null
  at: string
}

interface ColumnInfo {
  name: string
  pk: number
}

type Runner = Pick<EntityManager, 'query'> | DataSource

const META = new Set(['rev', 'org_id', 'updated_by'])
export const ROW_FIELD = '__row'

const q = (name: string): string => `"${name.replace(/"/g, '""')}"`

export const isSyncTable = (name: string): name is SyncTable =>
  (SYNC_TABLES as readonly string[]).includes(name)

export class LocalSyncStore {
  private columnsCache = new Map<string, ColumnInfo[]>()

  constructor(readonly db: DataSource) {}

  async get(key: string): Promise<string | null> {
    const rows: { value: string }[] = await this.db.query(
      `SELECT value FROM sync_state WHERE key = ?`,
      [key]
    )
    return rows[0]?.value ?? null
  }

  async set(key: string, value: string | null, runner: Runner = this.db): Promise<void> {
    if (value === null) await runner.query(`DELETE FROM sync_state WHERE key = ?`, [key])
    else
      await runner.query(
        `INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      )
  }

  async number(key: string): Promise<number> {
    return Number((await this.get(key)) ?? 0) || 0
  }

  async pending(after: number, limit: number): Promise<ChangeRow[]> {
    return this.db.query(
      `SELECT seq, entity, entity_id, op, fields, at FROM change_log WHERE seq > ? ORDER BY seq LIMIT ?`,
      [after, limit]
    )
  }

  async pendingCount(after: number): Promise<number> {
    const rows: { n: number }[] = await this.db.query(
      `SELECT count(*) AS n FROM change_log WHERE seq > ? AND op <> 'purge'`,
      [after]
    )
    return Number(rows[0]?.n ?? 0)
  }

  async maxSeq(): Promise<number> {
    const rows: { n: number | null }[] = await this.db.query(`SELECT max(seq) AS n FROM change_log`)
    return Number(rows[0]?.n ?? 0)
  }

  async columns(table: SyncTable, runner: Runner = this.db): Promise<ColumnInfo[]> {
    const cached = this.columnsCache.get(table)
    if (cached) return cached
    const list: ColumnInfo[] = await runner.query(`PRAGMA table_info(${q(table)})`)
    this.columnsCache.set(table, list)
    return list
  }

  async syncable(table: SyncTable, runner: Runner = this.db): Promise<string[]> {
    const hidden = new Set<string>([...(NEVER_SYNC.columns[table] ?? []), ...META])
    return (await this.columns(table, runner)).map((c) => c.name).filter((c) => !hidden.has(c))
  }

  async keys(table: SyncTable, runner: Runner = this.db): Promise<string[]> {
    const pk = (await this.columns(table, runner))
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
    return pk.length ? pk.map((c) => c.name) : ['rowid']
  }

  async keyWhere(
    table: SyncTable,
    id: string,
    runner: Runner = this.db
  ): Promise<{ sql: string; params: string[] }> {
    const keys = await this.keys(table, runner)
    const parts = keys.length === 1 ? [id] : id.split(':')
    if (parts.length !== keys.length) throw new Error(`Id inválido para ${table}.`)
    return { sql: keys.map((k) => `${q(k)} = ?`).join(' AND '), params: parts }
  }

  async row(
    table: SyncTable,
    id: string,
    runner: Runner = this.db
  ): Promise<Record<string, unknown> | null> {
    const where = await this.keyWhere(table, id, runner)
    const rows: Record<string, unknown>[] = await runner.query(
      `SELECT * FROM ${q(table)} WHERE ${where.sql}`,
      where.params
    )
    return rows[0] ?? null
  }

  async page(table: SyncTable, offset: number, limit: number): Promise<Record<string, unknown>[]> {
    return this.db.query(`SELECT * FROM ${q(table)} LIMIT ? OFFSET ?`, [limit, offset])
  }

  async idOf(table: SyncTable, row: Record<string, unknown>): Promise<string> {
    return (await this.keys(table)).map((k) => String(row[k])).join(':')
  }

  async revs(table: string, id: string, runner: Runner = this.db): Promise<Map<string, string>> {
    const rows: { field: string; rev: string }[] = await runner.query(
      `SELECT field, rev FROM sync_revs WHERE entity = ? AND entity_id = ?`,
      [table, id]
    )
    return new Map(rows.map((r) => [r.field, r.rev]))
  }

  async setRevs(
    table: string,
    id: string,
    fields: string[],
    rev: string,
    runner: Runner = this.db
  ): Promise<void> {
    for (const field of fields) {
      await runner.query(
        `INSERT INTO sync_revs (entity, entity_id, field, rev) VALUES (?, ?, ?, ?)
         ON CONFLICT(entity, entity_id, field) DO UPDATE SET rev = excluded.rev WHERE excluded.rev > sync_revs.rev`,
        [table, id, field, rev]
      )
    }
  }

  async counts(): Promise<{ entity: string; rows: number }[]> {
    const out: { entity: string; rows: number }[] = []
    for (const table of SYNC_TABLES.filter(isRecordSynced)) {
      const rows: { n: number }[] = await this.db
        .query(`SELECT count(*) AS n FROM ${q(table)}`)
        .catch(() => [{ n: 0 }])
      out.push({ entity: table, rows: Number(rows[0]?.n ?? 0) })
    }
    return out
  }

  async resetSync(): Promise<void> {
    await this.db.query(`DELETE FROM sync_state`)
    await this.db.query(`DELETE FROM sync_revs`)
  }
}

export { q as quoteIdent }
