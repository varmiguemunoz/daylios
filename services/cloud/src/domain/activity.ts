import type { ActivityEntity, ActivityVerb } from '@shared/activity'
import { visible, type Mutation, type RecordState } from '@shared/sync-merge'

export interface ActivityDraft {
  verb: ActivityVerb
  entity: ActivityEntity
  entityId: string
  title: string
  detail: string | null
  targetId: string | null
}

export type StageLookup = (id: string) => Promise<{ name: string; kind: string } | null>

type Row = Record<string, unknown>

const TRACKED = new Set<ActivityEntity>([
  'clients',
  'projects',
  'meetings',
  'prospects',
  'contacts',
  'tasks',
  'pipelines',
  'file_manifest',
  'automations'
])

const NOISE = new Set([
  'id',
  'created_at',
  'updated_at',
  'updated_by',
  'rev',
  'org_id',
  'position',
  'carried_from',
  'mtime',
  'size',
  'deleted_at',
  'assignee_id'
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const baseName = (path: unknown): string => text(path).split('/').pop() ?? ''

export function titleOf(entity: ActivityEntity, row: Row | null): string {
  if (!row) return ''
  const raw =
    entity === 'meetings' || entity === 'tasks'
      ? text(row.title)
      : entity === 'prospects'
        ? text(row.company)
        : entity === 'contacts'
          ? text(row.name) || text(row.email)
          : entity === 'file_manifest'
            ? baseName(row.path)
            : text(row.name)
  return raw.slice(0, 300)
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export async function describeChange(
  m: Mutation,
  before: RecordState | null,
  after: RecordState,
  stage: StageLookup
): Promise<ActivityDraft[]> {
  const entity = m.entity as ActivityEntity
  if (!TRACKED.has(entity)) return []
  const prev = visible(before)
  const next = visible(after)
  const draft = (verb: ActivityVerb, extra: Partial<ActivityDraft> = {}): ActivityDraft => ({
    verb,
    entity,
    entityId: m.id,
    title: titleOf(entity, next ?? prev),
    detail: null,
    targetId: null,
    ...extra
  })
  if (m.op === 'delete') return prev && !next ? [draft('deleted')] : []
  if (!next) return []
  const changed = (key: string): boolean => key in m.fields && !same(prev?.[key], next[key])
  const out: ActivityDraft[] = []
  const alive = !prev || !prev.deleted_at
  if (!prev) out.push(draft(entity === 'file_manifest' ? 'uploaded' : 'created'))
  else if (changed('deleted_at')) out.push(draft(next.deleted_at ? 'deleted' : 'restored'))
  if (next.deleted_at) return out
  if (prev && alive) {
    if (entity === 'prospects' && changed('stage_id')) {
      const target = await stage(text(next.stage_id))
      const kind = target?.kind
      out.push(
        kind === 'won' || kind === 'lost'
          ? draft(kind)
          : draft('moved', { detail: target?.name.slice(0, 300) ?? null })
      )
    }
    if (entity === 'tasks' && (changed('status') || changed('done'))) {
      const done = next.status === 'done' || next.done === true || next.done === 1
      const was = prev.status === 'done' || prev.done === true || prev.done === 1
      if (done && !was) out.push(draft('completed'))
    }
    if (entity === 'file_manifest' && changed('path')) {
      out.push(draft('renamed', { detail: baseName(prev.path) || null }))
    } else if (entity === 'file_manifest' && changed('hash')) {
      out.push(draft('updated'))
    }
    if (entity === 'automations' && changed('version_number') && next.version_number) {
      out.push(draft('published', { detail: `v${String(next.version_number)}` }))
    } else if (entity === 'automations' && changed('status') && next.status === 'paused') {
      out.push(draft('paused'))
    }
  }
  const assignee = text(next.assignee_id)
  if (changed('assignee_id') && UUID.test(assignee)) {
    out.push(draft('assigned', { targetId: assignee }))
  }
  if (prev && alive && !out.length && entity !== 'file_manifest') {
    const keys =
      entity === 'automations' ? ['name'] : Object.keys(m.fields).filter((k) => !NOISE.has(k))
    if (keys.some(changed)) out.push(draft('updated'))
  }
  return out
}
