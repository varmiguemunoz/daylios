import { newer } from './hlc'

export interface FieldVersion {
  value: unknown
  rev: string
}

export interface RecordState {
  id: string
  fields: Record<string, FieldVersion>

  deletedRev: string | null
}

export interface Mutation {
  entity: string
  id: string
  op: 'upsert' | 'delete'

  fields: Record<string, unknown>
  rev: string
}

export function applyMutation(state: RecordState | null, m: Mutation): RecordState {
  const next: RecordState = state
    ? { id: state.id, fields: { ...state.fields }, deletedRev: state.deletedRev }
    : { id: m.id, fields: {}, deletedRev: null }
  if (m.op === 'delete') {
    if (newer(m.rev, next.deletedRev)) next.deletedRev = m.rev
    return next
  }
  for (const [key, value] of Object.entries(m.fields)) {
    const current = next.fields[key]
    if (!current || newer(m.rev, current.rev)) next.fields[key] = { value, rev: m.rev }
  }
  return next
}

const lastEdit = (s: RecordState): string =>
  Object.values(s.fields).reduce((max, f) => (f.rev > max ? f.rev : max), '')

export function visible(state: RecordState | null): Record<string, unknown> | null {
  if (!state) return null
  if (state.deletedRev && !newer(lastEdit(state), state.deletedRev)) return null
  return Object.fromEntries(Object.entries(state.fields).map(([k, f]) => [k, f.value]))
}

export function stateToMutations(entity: string, state: RecordState): Mutation[] {
  const byRev = new Map<string, Record<string, unknown>>()
  for (const [key, field] of Object.entries(state.fields)) {
    const group = byRev.get(field.rev) ?? {}
    group[key] = field.value
    byRev.set(field.rev, group)
  }
  const list: Mutation[] = [...byRev.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([rev, fields]) => ({ entity, id: state.id, op: 'upsert', fields, rev }))
  if (state.deletedRev)
    list.push({ entity, id: state.id, op: 'delete', fields: {}, rev: state.deletedRev })
  return list
}
