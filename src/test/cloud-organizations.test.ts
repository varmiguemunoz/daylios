import { describe, expect, it } from 'vitest'
import { ROLES, can, canAssignRole, type OrgAction, type Role } from '../shared/organizations'
import {
  acceptProblem,
  hashInviteToken,
  invitationStatus,
  newInviteToken,
  type Invitation
} from '../../services/cloud/src/domain/invitation'
import { ManageOrganizations } from '../../services/cloud/src/application/organizations'
import type {
  AuthUser,
  InvitationRow,
  Mailer,
  MemberRow,
  MembershipRepository,
  OrgRepository,
  OrgRow,
  ProfileRepository
} from '../../services/cloud/src/ports'

const MATRIX: Record<OrgAction, Role[]> = {
  'data.read': ['owner', 'admin', 'member', 'viewer'],
  'data.write': ['owner', 'admin', 'member'],
  'org.rename': ['owner'],
  'org.delete': ['owner'],
  'org.transfer': ['owner'],
  'member.invite': ['owner', 'admin'],
  'member.remove': ['owner', 'admin'],
  'member.role': ['owner', 'admin'],
  'org.leave': ['admin', 'member', 'viewer']
}

describe('matriz de permisos', () => {
  for (const [action, allowed] of Object.entries(MATRIX) as [OrgAction, Role[]][]) {
    it(action, () => {
      const target = { role: 'member' as Role, userId: 'otro' }
      for (const role of ROLES) {
        expect(can({ role, userId: 'yo' }, action, target)).toBe(allowed.includes(role))
      }
    })
  }

  it('nadie cambia ni quita al dueño, ni a sí mismo', () => {
    const owner = { role: 'owner' as Role, userId: 'o' }
    const admin = { role: 'admin' as Role, userId: 'a' }
    expect(can(admin, 'member.remove', owner)).toBe(false)
    expect(can(admin, 'member.role', admin)).toBe(false)
    expect(canAssignRole(owner, 'owner')).toBe(false)
    expect(canAssignRole(admin, 'viewer')).toBe(true)
  })
})

const DAY = 86_400_000
const NOW = Date.parse('2026-10-14T12:00:00Z')

const invitation = (patch: Partial<Invitation> = {}): Invitation => ({
  id: 'i1',
  orgId: 'o1',
  email: 'ana@acme.com',
  role: 'member',
  tokenHash: 'h',
  invitedBy: 'u1',
  expiresAt: new Date(NOW + 7 * DAY).toISOString(),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date(NOW).toISOString(),
  ...patch
})

describe('invitaciones', () => {
  it('el token es largo y solo se guarda su hash', () => {
    const token = newInviteToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashInviteToken(token)).not.toContain(token)
  })

  it('estados: pendiente, aceptada, revocada y caducada', () => {
    expect(invitationStatus(invitation(), NOW)).toBe('pending')
    expect(invitationStatus(invitation({ acceptedAt: 'x' }), NOW)).toBe('accepted')
    expect(invitationStatus(invitation({ revokedAt: 'x' }), NOW)).toBe('revoked')
    expect(invitationStatus(invitation(), NOW + 8 * DAY)).toBe('expired')
  })

  it('solo sirve para su email; el enlace sin email sirve a cualquiera', () => {
    expect(acceptProblem(invitation(), 'otro@acme.com', NOW)).toBe('email-mismatch')
    expect(acceptProblem(invitation(), 'ANA@acme.com', NOW)).toBeNull()
    expect(acceptProblem(invitation({ email: null }), 'otro@acme.com', NOW)).toBeNull()
    expect(acceptProblem(null, 'ana@acme.com', NOW)).toBe('not-found')
  })
})

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function setup(
  role: Role,
  maxMembers = 5
): {
  service: ManageOrganizations
  me: AuthUser
  sent: string[]
  invitations: Invitation[]
  members: MemberRow[]
} {
  const me: AuthUser = { userId: '33333333-3333-4333-8333-333333333333', email: 'yo@acme.com' }
  const members: MemberRow[] = [
    { userId: me.userId, name: 'Yo', email: me.email, role },
    { userId: OTHER, name: 'Ana', email: 'ana@acme.com', role: 'member' }
  ]
  const invitations: Invitation[] = []
  const sent: string[] = []
  const org: OrgRow = { id: ORG, name: 'Acme', plan: 'trial', maxMembers, role, members: 2 }
  const memberships: MembershipRepository = {
    find: async () => ({
      org,
      membership: { orgId: ORG, userId: me.userId, role, status: 'active' }
    })
  }
  const repo = {
    members: async () => members,
    listMine: async () => [org],
    insertInvitation: async (
      _u: AuthUser,
      inv: Omit<Invitation, 'id' | 'createdAt' | 'acceptedAt' | 'revokedAt'>
    ) => {
      const row = {
        ...inv,
        id: `i${invitations.length}`,
        createdAt: new Date(NOW).toISOString(),
        acceptedAt: null,
        revokedAt: null
      }
      invitations.push(row)
      return row
    },
    invitations: async () => invitations,
    audit: async () => undefined,
    setRole: async (_u: AuthUser, _o: string, userId: string, next: Role) => {
      const m = members.find((x) => x.userId === userId)
      if (m) m.role = next
    },
    invitationByHash: async (_u: AuthUser, hash: string): Promise<InvitationRow | null> => {
      const inv = invitations.find((i) => i.tokenHash === hash)
      return inv ? { ...inv, orgName: 'Acme' } : null
    }
  } as unknown as OrgRepository
  const mailer: Mailer = { sendInvite: async (mail) => (sent.push(mail.to), true) }
  const profiles = {
    get: async () => ({ userId: me.userId, name: 'Yo', email: me.email })
  } as unknown as ProfileRepository
  const service = new ManageOrganizations(
    repo,
    memberships,
    profiles,
    mailer,
    { now: () => NOW },
    'https://cloud.test'
  )
  return { service, me, sent, invitations, members }
}

describe('organizaciones: casos de uso', () => {
  it('un admin invita por email y el enlace lleva el token, no el hash', async () => {
    const { service, me, sent, invitations } = setup('admin')
    const result = await service.invite(me, ORG, { email: 'nuevo@acme.com', role: 'viewer' })
    expect(result.emailed).toBe(true)
    expect(sent).toEqual(['nuevo@acme.com'])
    expect(result.link).toMatch(/^https:\/\/cloud\.test\/invite\//)
    expect(result.link).not.toContain(invitations[0].tokenHash)
  })

  it('un miembro o un lector no invitan', async () => {
    for (const role of ['member', 'viewer'] as Role[]) {
      const { service, me } = setup(role)
      await expect(service.invite(me, ORG, { role: 'member' })).rejects.toThrow(/rol/)
    }
  })

  it('nadie invita como dueño', async () => {
    const { service, me } = setup('owner')
    await expect(service.invite(me, ORG, { role: 'owner' })).rejects.toThrow()
  })

  it('respeta el límite de miembros del plan', async () => {
    const { service, me } = setup('owner', 2)
    await expect(service.invite(me, ORG, { role: 'member' })).rejects.toThrow(/2 miembros/)
  })

  it('un enlace sin email no envía nada y se puede copiar', async () => {
    const { service, me, sent } = setup('owner')
    const result = await service.invite(me, ORG, { role: 'member' })
    expect(result.emailed).toBe(false)
    expect(sent).toEqual([])
  })

  it('la invitación para otro email no se acepta', async () => {
    const { service, me } = setup('owner')
    const { link } = await service.invite(me, ORG, { email: 'otro@acme.com', role: 'member' })
    const token = link.split('/').pop() as string
    await expect(service.accept(me, token)).rejects.toThrow(/otro email/)
  })

  it('el admin cambia el rol de un miembro pero no puede dar la propiedad', async () => {
    const { service, me, members } = setup('admin')
    await service.changeRole(me, ORG, OTHER, 'viewer')
    expect(members[1].role).toBe('viewer')
    await expect(service.changeRole(me, ORG, OTHER, 'owner')).rejects.toThrow(/Transferir/)
  })

  it('el dueño no puede salir sin transferir', async () => {
    const { service, me } = setup('owner')
    await expect(service.leave(me, ORG)).rejects.toThrow(/Transfiere/)
  })
})
