import type { DataSource } from 'typeorm'
import {
  LOCAL_CHANGE_LOG_LIMIT,
  NEVER_SYNC,
  SOFT_DELETE_DAYS,
  SOFT_DELETE_TABLES,
  SYNC_TABLES,
  type Edition,
  type SyncTable
} from '@shared/edition'

interface ColumnInfo {
  name: string
  pk: number
}

const q = (name: string): string => `"${name.replace(/"/g, '""')}"`
const AT = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

const tracked = (table: SyncTable, columns: ColumnInfo[]): string[] => {
  const hidden = new Set<string>([...(NEVER_SYNC.columns[table] ?? []), 'rev', 'updated_by'])
  return columns.map((c) => c.name).filter((c) => !hidden.has(c))
}

export function changeTriggersSql(table: SyncTable, columns: ColumnInfo[]): string[] {
  const keys = columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name)
  const idOf = (row: 'NEW' | 'OLD'): string =>
    keys.map((k) => `${row}.${q(k)}`).join(` || ':' || `) || `${row}.rowid`
  const cols = tracked(table, columns)
  const changed = cols.map((c) => `OLD.${q(c)} IS NOT NEW.${q(c)}`).join(' OR ') || '0'
  const fields = `rtrim(${cols
    .map((c) => `CASE WHEN OLD.${q(c)} IS NOT NEW.${q(c)} THEN '${c},' ELSE '' END`)
    .join(' || ')}, ',')`
  const soft = SOFT_DELETE_TABLES.includes(table)
  const updateOp = soft
    ? `CASE WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'delete'
            WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'restore'
            ELSE 'update' END`
    : `'update'`
  const name = (op: string): string => q(`change_log_${table}_${op}`)
  const log = (op: string, row: 'NEW' | 'OLD', f: string): string =>
    `INSERT INTO change_log (entity, entity_id, op, fields, at, by) VALUES ('${table}', ${idOf(row)}, ${op}, ${f}, ${AT}, daylios_author());`
  return [
    `DROP TRIGGER IF EXISTS ${name('insert')}`,
    `DROP TRIGGER IF EXISTS ${name('update')}`,
    `DROP TRIGGER IF EXISTS ${name('delete')}`,
    `CREATE TRIGGER ${name('insert')} AFTER INSERT ON ${q(table)} WHEN daylios_syncing() = 0 BEGIN ${log(`'insert'`, 'NEW', 'NULL')} END`,
    `CREATE TRIGGER ${name('update')} AFTER UPDATE ON ${q(table)} WHEN daylios_syncing() = 0 AND (${changed}) BEGIN ${log(updateOp, 'NEW', fields)} END`,
    `CREATE TRIGGER ${name('delete')} AFTER DELETE ON ${q(table)} WHEN daylios_syncing() = 0 BEGIN ${log(soft ? `'purge'` : `'delete'`, 'OLD', 'NULL')} END`
  ]
}

export async function installChangeTriggers(db: DataSource): Promise<void> {
  const existing: { name: string }[] = await db.query(
    `SELECT name FROM sqlite_master WHERE type = 'table'`
  )
  const tables = new Set(existing.map((t) => t.name))
  if (!tables.has('change_log')) return
  for (const table of SYNC_TABLES) {
    if (!tables.has(table)) continue
    const columns: ColumnInfo[] = await db.query(`PRAGMA table_info(${q(table)})`)
    for (const sql of changeTriggersSql(table, columns)) await db.query(sql)
  }
}

export async function maintainDatabase(db: DataSource, edition: Edition): Promise<void> {
  for (const table of SOFT_DELETE_TABLES) {
    await db.query(
      `DELETE FROM ${q(table)} WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`,
      [`-${SOFT_DELETE_DAYS} days`]
    )
  }
  if (edition === 'local') await trimChangeLog(db, LOCAL_CHANGE_LOG_LIMIT)
}

export async function trimChangeLog(db: DataSource, keep: number): Promise<void> {
  await db.query(
    `DELETE FROM change_log WHERE seq <= (SELECT COALESCE(MAX(seq), 0) FROM change_log) - ?`,
    [keep]
  )
}
