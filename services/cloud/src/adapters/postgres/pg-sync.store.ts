import type { Pool, PoolClient } from 'pg'
import type { BootstrapRecord, PulledMutation, SyncMutation } from '@shared/sync-protocol'
import type { RecordState } from '@shared/sync-merge'
import { BURST_MS, type ActivityEntry } from '@shared/activity'
import type { ActivityDraft } from '../../domain/activity'
import type { AuthUser, SyncStore, SyncTransaction } from '../../ports'
import { asUser } from './as-user'

class PgSyncTransaction implements SyncTransaction {
  constructor(
    private readonly c: PoolClient,
    private readonly orgId: string
  ) {}

  async insertMutation(m: SyncMutation, by: string): Promise<boolean> {
    const { rowCount } = await this.c.query(
      `INSERT INTO public.mutations (org_id, mutation_id, entity, entity_id, op, fields, rev, by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, mutation_id) DO NOTHING`,
      [this.orgId, m.mutationId, m.entity, m.id, m.op, JSON.stringify(m.fields), m.rev, by]
    )
    return (rowCount ?? 0) > 0
  }

  async record(entity: string, id: string): Promise<RecordState | null> {
    const { rows } = await this.c.query<{ state: RecordState }>(
      `SELECT state FROM public.records WHERE org_id = $1 AND entity = $2 AND entity_id = $3 FOR UPDATE`,
      [this.orgId, entity, id]
    )
    return rows[0]?.state ?? null
  }

  async saveRecord(entity: string, state: RecordState): Promise<void> {
    await this.c.query(
      `INSERT INTO public.records (org_id, entity, entity_id, state) VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, entity, entity_id) DO UPDATE SET state = excluded.state, updated_at = now()`,
      [this.orgId, entity, state.id, JSON.stringify(state)]
    )
  }

  async cursor(): Promise<number> {
    const { rows } = await this.c.query<{ cursor: string | null }>(
      `SELECT max(cursor) AS cursor FROM public.mutations WHERE org_id = $1`,
      [this.orgId]
    )
    return Number(rows[0]?.cursor ?? 0)
  }

  async addActivity(d: ActivityDraft, actorId: string): Promise<void> {
    if (d.verb === 'updated') {
      const { rowCount } = await this.c.query(
        `UPDATE public.activity
            SET count = count + 1, seq = nextval('public.activity_seq'), at = now(), title = $6
          WHERE id = (
            SELECT id FROM public.activity
             WHERE org_id = $1 AND actor_id = $2 AND verb = 'updated' AND entity = $3
               AND entity_id = $4 AND at > now() - make_interval(secs => $5)
             ORDER BY id DESC LIMIT 1
          )`,
        [this.orgId, actorId, d.entity, d.entityId, BURST_MS / 1000, d.title]
      )
      if (rowCount) return
    }
    await this.c.query(
      `INSERT INTO public.activity (org_id, actor_id, verb, entity, entity_id, title, detail, target_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [this.orgId, actorId, d.verb, d.entity, d.entityId, d.title, d.detail, d.targetId]
    )
  }
}

export class PgSyncStore implements SyncStore {
  constructor(private readonly pool: Pool) {}

  write<T>(user: AuthUser, orgId: string, work: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    return asUser(this.pool, user, async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [orgId])
      return work(new PgSyncTransaction(c, orgId))
    })
  }

  pull(user: AuthUser, orgId: string, since: number, limit: number): Promise<PulledMutation[]> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<{
        cursor: string
        entity: string
        entity_id: string
        op: 'upsert' | 'delete'
        fields: Record<string, unknown>
        rev: string
        by: string | null
      }>(
        `SELECT cursor, entity, entity_id, op, fields, rev, by FROM public.mutations
          WHERE org_id = $1 AND cursor > $2 ORDER BY cursor LIMIT $3`,
        [orgId, since, limit]
      )
      return rows.map((r) => ({
        cursor: Number(r.cursor),
        entity: r.entity,
        id: r.entity_id,
        op: r.op,
        fields: r.fields,
        rev: r.rev,
        by: r.by
      }))
    })
  }

  cursor(user: AuthUser, orgId: string): Promise<number> {
    return this.write(user, orgId, (tx) => tx.cursor())
  }

  records(
    user: AuthUser,
    orgId: string,
    after: string | null,
    limit: number
  ): Promise<{ records: BootstrapRecord[]; total: number }> {
    return asUser(this.pool, user, async (c) => {
      const [entity, id] = after ? after.split('\u0001') : ['', '']
      const { rows } = await c.query<{ entity: string; state: RecordState }>(
        `SELECT entity, state FROM public.records
          WHERE org_id = $1 AND (entity, entity_id) > ($2, $3)
          ORDER BY entity, entity_id LIMIT $4`,
        [orgId, entity, id ?? '', limit]
      )
      const total = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM public.records WHERE org_id = $1`,
        [orgId]
      )
      return { records: rows, total: Number(total.rows[0]?.n ?? 0) }
    })
  }

  activity(user: AuthUser, orgId: string, since: number, limit: number): Promise<ActivityEntry[]> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<{
        id: string
        seq: string
        actor_id: string | null
        verb: ActivityEntry['verb']
        entity: ActivityEntry['entity']
        entity_id: string
        title: string
        detail: string | null
        target_id: string | null
        count: number
        at: Date
      }>(
        `SELECT id, seq, actor_id, verb, entity, entity_id, title, detail, target_id, count, at
           FROM public.activity WHERE org_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
        [orgId, since, limit]
      )
      return rows.map((r) => ({
        id: Number(r.id),
        seq: Number(r.seq),
        actorId: r.actor_id,
        verb: r.verb,
        entity: r.entity,
        entityId: r.entity_id,
        title: r.title,
        detail: r.detail,
        targetId: r.target_id,
        count: r.count,
        at: new Date(r.at).toISOString()
      }))
    })
  }
}
