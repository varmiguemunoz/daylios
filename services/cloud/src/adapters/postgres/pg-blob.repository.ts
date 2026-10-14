import type { Pool } from 'pg'
import type { AuthUser, BlobRepository } from '../../ports'
import { asUser } from './as-user'

export class PgBlobRepository implements BlobRepository {
  constructor(private readonly pool: Pool) {}

  exists(user: AuthUser, orgId: string, hash: string): Promise<boolean> {
    return asUser(this.pool, user, async (c) => {
      const { rowCount } = await c.query(
        `SELECT 1 FROM public.blobs WHERE org_id = $1 AND hash = $2`,
        [orgId, hash]
      )
      return (rowCount ?? 0) > 0
    })
  }

  add(user: AuthUser, orgId: string, hash: string, size: number): Promise<void> {
    return asUser(this.pool, user, async (c) => {
      await c.query(
        `INSERT INTO public.blobs (org_id, hash, size, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, hash) DO NOTHING`,
        [orgId, hash, size, user.userId]
      )
    })
  }

  usage(user: AuthUser, orgId: string): Promise<{ bytes: number; limitBytes: number }> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<{ bytes: string | null; limit_bytes: string }>(
        `SELECT (SELECT sum(size) FROM public.blobs WHERE org_id = $1) AS bytes, p.max_storage_bytes AS limit_bytes
           FROM public.organizations o JOIN public.plans p ON p.id = o.plan WHERE o.id = $1`,
        [orgId]
      )
      return { bytes: Number(rows[0]?.bytes ?? 0), limitBytes: Number(rows[0]?.limit_bytes ?? 0) }
    })
  }

  async purgeCandidates(
    graceDays: number,
    trashDays: number
  ): Promise<{ orgId: string; hash: string }[]> {
    const { rows } = await this.pool.query<{ org_id: string; hash: string }>(
      `SELECT org_id, hash FROM public.purge_candidates(make_interval(days => $1), make_interval(days => $2))`,
      [graceDays, trashDays]
    )
    return rows.map((r) => ({ orgId: r.org_id, hash: r.hash }))
  }

  async forget(orgId: string, hash: string): Promise<void> {
    await this.pool.query(`SELECT public.forget_blob($1, $2)`, [orgId, hash])
  }
}
