import { randomUUID } from 'crypto'
import { encodeHlc, tick, type Hlc } from '@shared/hlc'
import { isRecordSynced } from '@shared/edition'
import type { SyncMutation } from '@shared/sync-protocol'
import { isSyncTable, type ChangeRow, type LocalSyncStore } from './local-store'

export interface OutgoingRev {
  entity: string
  id: string
  fields: string[]
  rev: string
}

export interface Outgoing {
  mutations: SyncMutation[]
  revs: OutgoingRev[]
  lastSeq: number
  hlc: Hlc
}

export async function buildOutgoing(
  rows: ChangeRow[],
  store: LocalSyncStore,
  deviceId: string,
  start: Hlc
): Promise<Outgoing> {
  const groups = new Map<string, ChangeRow[]>()
  for (const row of rows) {
    const key = `${row.entity}\u0001${row.entity_id}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  let hlc = start
  const mutations: SyncMutation[] = []
  const revs: OutgoingRev[] = []
  for (const list of groups.values()) {
    const last = list[list.length - 1]
    const table = last.entity
    if (!isSyncTable(table) || !isRecordSynced(table) || last.op === 'purge') continue
    hlc = tick(hlc, Date.parse(last.at) || Date.now())
    const rev = encodeHlc(hlc)
    const mutationId = `${deviceId}:${last.seq}`
    if (last.op === 'delete' && !(await store.row(table, last.entity_id))) {
      mutations.push({
        mutationId,
        entity: table,
        id: last.entity_id,
        op: 'delete',
        fields: {},
        rev
      })
      continue
    }
    const current = await store.row(table, last.entity_id)
    if (!current) continue
    const allowed = new Set(await store.syncable(table))
    const names = list.some((r) => r.op === 'insert')
      ? [...allowed]
      : [...new Set(list.flatMap((r) => (r.fields ?? '').split(',').filter(Boolean)))].filter((f) =>
          allowed.has(f)
        )
    if (!names.length) continue
    const fields = Object.fromEntries(names.map((n) => [n, current[n] ?? null]))
    mutations.push({ mutationId, entity: table, id: last.entity_id, op: 'upsert', fields, rev })
    revs.push({ entity: table, id: last.entity_id, fields: names, rev })
  }
  return { mutations, revs, lastSeq: rows.length ? rows[rows.length - 1].seq : 0, hlc }
}

export async function snapshotPage(
  store: LocalSyncStore,
  table: string,
  offset: number,
  limit: number,
  start: Hlc
): Promise<{ mutations: SyncMutation[]; revs: OutgoingRev[]; hlc: Hlc; count: number }> {
  if (!isSyncTable(table) || !isRecordSynced(table))
    return { mutations: [], revs: [], hlc: start, count: 0 }
  const rows = await store.page(table, offset, limit)
  const allowed = await store.syncable(table)
  let hlc = start
  const mutations: SyncMutation[] = []
  const revs: OutgoingRev[] = []
  for (const row of rows) {
    hlc = tick(hlc, Date.now())
    const rev = encodeHlc(hlc)
    const id = await store.idOf(table, row)
    const fields = Object.fromEntries(allowed.map((n) => [n, row[n] ?? null]))
    mutations.push({
      mutationId: `seed-${randomUUID()}`,
      entity: table,
      id,
      op: 'upsert',
      fields,
      rev
    })
    revs.push({ entity: table, id, fields: allowed, rev })
  }
  return { mutations, revs, hlc, count: rows.length }
}
