import type { Pool } from 'pg'
import type { Membership, Organization } from '../../domain/membership'
import type { AuthUser, MembershipRepository } from '../../ports'
import { asUser } from './as-user'

interface Row {
  org_id: string
  org_name: string
  plan: string
  max_members: number
  user_id: string
  role: Membership['role']
  status: Membership['status']
}

export class PgMembershipRepository implements MembershipRepository {
  constructor(private readonly pool: Pool) {}

  find(
    user: AuthUser,
    orgId: string
  ): Promise<{ org: Organization; membership: Membership } | null> {
    return asUser(this.pool, user, async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT o.id AS org_id, o.name AS org_name, o.plan, p.max_members, m.user_id, m.role, m.status
           FROM public.memberships m
           JOIN public.organizations o ON o.id = m.org_id
           JOIN public.plans p ON p.id = o.plan
          WHERE m.org_id = $1 AND m.user_id = $2 AND o.deleted_at IS NULL`,
        [orgId, user.userId]
      )
      const row = rows[0]
      if (!row) return null
      return {
        org: { id: row.org_id, name: row.org_name, plan: row.plan, maxMembers: row.max_members },
        membership: { orgId: row.org_id, userId: row.user_id, role: row.role, status: row.status }
      }
    })
  }
}
