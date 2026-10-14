import { newer } from '@shared/hlc'
import { SOFT_DELETE_TABLES, isRecordSynced, type SyncTable } from '@shared/edition'
import type { Mutation } from '@shared/sync-merge'
import type { RemoteDeletion } from '@shared/sync-protocol'
import type { EntityManager } from 'typeorm'
import { ROW_FIELD, isSyncTable, quoteIdent as q, type LocalSyncStore } from './local-store'

export type LocalFill = (
  table: SyncTable,
  row: Record<string, unknown>
) => Promise<Record<string, unknown>>

export interface Incoming {
  touched: Set<string>
  deletions: RemoteDeletion[]
  skipped: number
}

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

const maxRev = (revs: Map<string, string>): string => {
  let max = ''
  for (const rev of revs.values()) if (rev > max) max = rev
  return max
}

const fallback = (type: string): unknown => (/int|real|num|bool/i.test(type) ? 0 : '')

export async function applyIncoming(
  manager: EntityManager,
  store: LocalSyncStore,
  mutations: Mutation[],
  fill: LocalFill
): Promise<Incoming> {
  const result: Incoming = { touched: new Set(), deletions: [], skipped: 0 }
  for (const m of mutations) {
    if (!isSyncTable(m.entity) || !isRecordSynced(m.entity)) continue
    const table = m.entity
    const local = await store.revs(table, m.id, manager)
    const deletedRev = local.get(ROW_FIELD)

    if (m.op === 'delete') {
      if (!newer(m.rev, maxRev(local))) continue
      const where = await store.keyWhere(table, m.id, manager)
      await manager.query(`DELETE FROM ${q(table)} WHERE ${where.sql}`, where.params)
      await store.setRevs(table, m.id, [ROW_FIELD], m.rev, manager)
      result.touched.add(table)
      continue
    }
    if (deletedRev && !newer(m.rev, deletedRev)) continue

    const allowed = new Set(await store.syncable(table, manager))
    const accepted = Object.entries(m.fields).filter(
      ([k]) => allowed.has(k) && newer(m.rev, local.get(k))
    )
    if (!accepted.length) continue

    const existing = await store.row(table, m.id, manager)
    if (existing) {
      const sets = accepted.map(([k]) => `${q(k)} = ?`).join(', ')
      const where = await store.keyWhere(table, m.id, manager)
      try {
        await manager.query(`UPDATE ${q(table)} SET ${sets} WHERE ${where.sql}`, [
          ...accepted.map(([, v]) => v),
          ...where.params
        ])
      } catch {
        result.skipped++
        continue
      }
      const deleted = accepted.find(([k]) => k === 'deleted_at')
      if (SOFT_DELETE_TABLES.includes(table) && deleted && deleted[1] && !existing.deleted_at) {
        result.deletions.push({ entity: table, id: m.id, at: new Date().toISOString() })
      }
    } else {
      const ok = await insertRow(manager, store, table, m.id, Object.fromEntries(accepted), fill)
      if (!ok) {
        result.skipped++
        continue
      }
    }
    await store.setRevs(
      table,
      m.id,
      accepted.map(([k]) => k),
      m.rev,
      manager
    )
    result.touched.add(table)
  }
  return result
}

async function insertRow(
  manager: EntityManager,
  store: LocalSyncStore,
  table: SyncTable,
  id: string,
  fields: Record<string, unknown>,
  fill: LocalFill
): Promise<boolean> {
  const columns: ColumnInfo[] = await manager.query(`PRAGMA table_info(${q(table)})`)
  const keys = await store.keys(table, manager)
  const row: Record<string, unknown> = { ...fields }
  const parts = keys.length === 1 ? [id] : id.split(':')
  keys.forEach((k, i) => {
    if (k !== 'rowid') row[k] = parts[i]
  })
  Object.assign(row, await fill(table, row))
  for (const c of columns) {
    if (c.notnull && row[c.name] === undefined && c.dflt_value === null && c.pk === 0) {
      row[c.name] = fallback(c.type)
    }
  }
  const names = Object.keys(row).filter((k) => columns.some((c) => c.name === k))
  try {
    await manager.query(
      `INSERT INTO ${q(table)} (${names.map(q).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      names.map((n) => row[n])
    )
    return true
  } catch {
    return false
  }
}
