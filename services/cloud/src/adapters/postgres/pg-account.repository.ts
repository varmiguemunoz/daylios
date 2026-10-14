import type { Pool } from 'pg'
import type { Device, Ownership, Profile } from '../../domain/account'
import type {
  AuthUser,
  DeviceRepository,
  OwnershipRepository,
  ProfileRepository
} from '../../ports'
import { asUser } from './as-user'

interface DeviceRow {
  id: string
  user_id: string
  name: string
  platform: string
  last_seen_at: Date
}

const toDevice = (r: DeviceRow): Device => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  platform: r.platform,
  lastSeenAt: r.last_seen_at.toISOString()
})

export class PgAccountRepository
  implements ProfileRepository, DeviceRepository, OwnershipRepository
{
  constructor(private readonly pool: Pool) {}

  get(user: AuthUser): Promise<Profile> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<{ name: string | null }>(
        `SELECT name FROM public.profiles WHERE user_id = $1`,
        [user.userId]
      )
      return { userId: user.userId, name: rows[0]?.name ?? null, email: user.email }
    })
  }

  setName(user: AuthUser, name: string): Promise<Profile> {
    return asUser(this.pool, user, async (c) => {
      await c.query(
        `INSERT INTO public.profiles (user_id, name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, updated_at = now()`,
        [user.userId, name]
      )
      return { userId: user.userId, name, email: user.email }
    })
  }

  list(user: AuthUser): Promise<Device[]> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<DeviceRow>(
        `SELECT id, user_id, name, platform, last_seen_at FROM public.devices
          WHERE user_id = $1 ORDER BY last_seen_at DESC`,
        [user.userId]
      )
      return rows.map(toDevice)
    })
  }

  touch(user: AuthUser, d: { id: string; name: string; platform: string }): Promise<Device> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<DeviceRow>(
        `INSERT INTO public.devices (id, user_id, name, platform) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, platform = excluded.platform,
           last_seen_at = now()
         WHERE public.devices.user_id = excluded.user_id
         RETURNING id, user_id, name, platform, last_seen_at`,
        [d.id, user.userId, d.name, d.platform]
      )
      if (!rows[0]) throw new Error('Ese dispositivo pertenece a otra cuenta.')
      return toDevice(rows[0])
    })
  }

  removeOthers(user: AuthUser, keepId: string): Promise<number> {
    return asUser(this.pool, user, async (c) => {
      const { rowCount } = await c.query(
        `DELETE FROM public.devices WHERE user_id = $1 AND id <> $2`,
        [user.userId, keepId]
      )
      return rowCount ?? 0
    })
  }

  owned(user: AuthUser): Promise<Ownership[]> {
    return asUser(this.pool, user, async (c) => {
      const { rows } = await c.query<{ org_id: string; name: string; others: string }>(
        `SELECT o.id AS org_id, o.name,
                (SELECT count(*) FROM public.memberships x
                  WHERE x.org_id = o.id AND x.user_id <> $1 AND x.status = 'active') AS others
           FROM public.memberships m
           JOIN public.organizations o ON o.id = m.org_id
          WHERE m.user_id = $1 AND m.role = 'owner' AND m.status = 'active'
            AND o.deleted_at IS NULL`,
        [user.userId]
      )
      return rows.map((r) => ({ orgId: r.org_id, name: r.name, otherMembers: Number(r.others) }))
    })
  }
}
