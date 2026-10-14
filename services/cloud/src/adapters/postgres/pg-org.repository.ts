import type { Pool, PoolClient } from 'pg'
import type { Role } from '@shared/organizations'
import type { Invitation } from '../../domain/invitation'
import type { AuthUser, InvitationRow, MemberRow, OrgRepository, OrgRow } from '../../ports'
import { asUser } from './as-user'

interface InvitationDb {
  id: string
  org_id: string
  email: string | null
  role: Role
  token_hash?: string
  invited_by: string
  expires_at: Date
  accepted_at: Date | null
  revoked_at: Date | null
  created_at: Date
  org_name?: string
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

const toInvitation = (r: InvitationDb): Invitation => ({
  id: r.id,
  orgId: r.org_id,
  email: r.email,
  role: r.role,
  tokenHash: r.token_hash ?? '',
  invitedBy: r.invited_by,
  expiresAt: r.expires_at.toISOString(),
  acceptedAt: iso(r.accepted_at),
  revokedAt: iso(r.revoked_at),
  createdAt: r.created_at.toISOString()
})

const INVITATION_COLUMNS =
  'id, org_id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at'

const sqlCode = (e: unknown): string => {
  const message = (e as { message?: string }).message ?? ''
  return message.replace(/^.*?:\s*/, '').trim()
}

export class PgOrgRepository implements OrgRepository {
  constructor(private readonly pool: Pool) {}

  private as<T>(user: AuthUser, work: (c: PoolClient) => Promise<T>): Promise<T> {
    return asUser(this.pool, user, work)
  }

  listMine(user: AuthUser): Promise<OrgRow[]> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<{
        id: string
        name: string
        plan: string
        max_members: number
        role: Role
        members: string
      }>(
        `SELECT o.id, o.name, o.plan, p.max_members, m.role,
                (SELECT count(*) FROM public.memberships x WHERE x.org_id = o.id AND x.status = 'active') AS members
           FROM public.memberships m
           JOIN public.organizations o ON o.id = m.org_id
           JOIN public.plans p ON p.id = o.plan
          WHERE m.user_id = $1 AND m.status = 'active' AND o.deleted_at IS NULL
          ORDER BY o.name`,
        [user.userId]
      )
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        plan: r.plan,
        maxMembers: r.max_members,
        role: r.role,
        members: Number(r.members)
      }))
    })
  }

  create(user: AuthUser, name: string): Promise<string> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `SELECT public.create_organization($1) AS id`,
        [name]
      )
      return rows[0].id
    })
  }

  rename(user: AuthUser, orgId: string, name: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(`UPDATE public.organizations SET name = $2 WHERE id = $1`, [orgId, name])
    })
  }

  softDelete(user: AuthUser, orgId: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(`UPDATE public.organizations SET deleted_at = now() WHERE id = $1`, [orgId])
    })
  }

  transfer(user: AuthUser, orgId: string, newOwner: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(`SELECT public.transfer_ownership($1, $2)`, [orgId, newOwner])
    })
  }

  members(user: AuthUser, orgId: string): Promise<MemberRow[]> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<{
        user_id: string
        role: Role
        name: string | null
        email: string | null
      }>(
        `SELECT m.user_id, m.role, p.name, u.email
           FROM public.memberships m
           LEFT JOIN public.profiles p ON p.user_id = m.user_id
           LEFT JOIN public.org_member_emails($1) u ON u.user_id = m.user_id
          WHERE m.org_id = $1 AND m.status = 'active'
          ORDER BY array_position(ARRAY['owner','admin','member','viewer']::public.org_role[], m.role), p.name`,
        [orgId]
      )
      return rows.map((r) => ({ userId: r.user_id, role: r.role, name: r.name, email: r.email }))
    })
  }

  invitations(user: AuthUser, orgId: string): Promise<Invitation[]> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<InvitationDb>(
        `SELECT ${INVITATION_COLUMNS} FROM public.invitations WHERE org_id = $1 ORDER BY created_at DESC`,
        [orgId]
      )
      return rows.map(toInvitation)
    })
  }

  insertInvitation(
    user: AuthUser,
    inv: Omit<Invitation, 'id' | 'createdAt' | 'acceptedAt' | 'revokedAt'>
  ): Promise<Invitation> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<InvitationDb>(
        `INSERT INTO public.invitations (org_id, email, role, token_hash, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${INVITATION_COLUMNS}`,
        [inv.orgId, inv.email, inv.role, inv.tokenHash, inv.invitedBy, inv.expiresAt]
      )
      return toInvitation(rows[0])
    })
  }

  invitation(user: AuthUser, orgId: string, id: string): Promise<Invitation | null> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<InvitationDb>(
        `SELECT ${INVITATION_COLUMNS} FROM public.invitations WHERE org_id = $1 AND id = $2`,
        [orgId, id]
      )
      return rows[0] ? toInvitation(rows[0]) : null
    })
  }

  renewInvitation(
    user: AuthUser,
    id: string,
    tokenHash: string,
    expiresAt: string
  ): Promise<Invitation> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<InvitationDb>(
        `UPDATE public.invitations SET token_hash = $2, expires_at = $3
          WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
          RETURNING ${INVITATION_COLUMNS}`,
        [id, tokenHash, expiresAt]
      )
      if (!rows[0]) throw new Error('Esa invitación ya no se puede reenviar.')
      return toInvitation(rows[0])
    })
  }

  revokeInvitation(user: AuthUser, id: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(
        `UPDATE public.invitations SET revoked_at = now() WHERE id = $1 AND accepted_at IS NULL`,
        [id]
      )
    })
  }

  invitationByHash(user: AuthUser, hash: string): Promise<InvitationRow | null> {
    return this.as(user, async (c) => {
      const { rows } = await c.query<InvitationDb>(
        `SELECT id, org_id, org_name, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at
           FROM public.invitation_by_hash($1)`,
        [hash]
      )
      const r = rows[0]
      return r ? { ...toInvitation({ ...r, token_hash: hash }), orgName: r.org_name ?? '' } : null
    })
  }

  async acceptInvitation(user: AuthUser, hash: string): Promise<string> {
    try {
      return await this.as(user, async (c) => {
        const { rows } = await c.query<{ id: string }>(
          `SELECT public.accept_invitation($1) AS id`,
          [hash]
        )
        return rows[0].id
      })
    } catch (e) {
      throw new Error(sqlCode(e))
    }
  }

  setRole(user: AuthUser, orgId: string, userId: string, role: Role): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(
        `UPDATE public.memberships SET role = $3 WHERE org_id = $1 AND user_id = $2 AND role <> 'owner'`,
        [orgId, userId, role]
      )
    })
  }

  removeMember(user: AuthUser, orgId: string, userId: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(
        `UPDATE public.memberships SET status = 'removed'
          WHERE org_id = $1 AND user_id = $2 AND role <> 'owner'`,
        [orgId, userId]
      )
    })
  }

  leave(user: AuthUser, orgId: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(`SELECT public.leave_organization($1)`, [orgId])
    })
  }

  audit(user: AuthUser, orgId: string, action: string, target?: string): Promise<void> {
    return this.as(user, async (c) => {
      await c.query(
        `INSERT INTO public.audit_log (org_id, actor, action, target) VALUES ($1, $2, $3, $4)`,
        [orgId, user.userId, action, target ?? null]
      )
    })
  }
}
