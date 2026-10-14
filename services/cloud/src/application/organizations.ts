import {
  INVITE_PATH,
  can,
  canAssignRole,
  type ActorRef,
  type InvitePreview,
  type InviteResult,
  type OrgAction,
  type OrgDetail,
  type OrgInvitation,
  type OrgSummary,
  type Role,
  ROLES
} from '@shared/organizations'
import { initials } from '../domain/account'
import {
  ACCEPT_MESSAGE,
  acceptProblem,
  cleanInviteEmail,
  hashInviteToken,
  invitationStatus,
  inviteExpiry,
  newInviteToken,
  type AcceptProblem,
  type Invitation
} from '../domain/invitation'
import type { Organization } from '../domain/membership'
import type {
  AuthUser,
  Clock,
  InvitationRow,
  Mailer,
  MembershipRepository,
  OrgRepository,
  ProfileRepository
} from '../ports'
import { UseCaseError, invalid } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function cleanOrgName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('El nombre debe ser texto.')
  const name = value.replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('Escribe un nombre para la organización.')
  if (name.length > 120) throw new Error('El nombre admite hasta 120 caracteres.')
  return name
}

const id = (value: unknown, what: string): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new UseCaseError(`${what} inválido.`, 'invalid')
  return value
}

export class ManageOrganizations {
  constructor(
    private readonly orgs: OrgRepository,
    private readonly memberships: MembershipRepository,
    private readonly profiles: ProfileRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly publicUrl: string
  ) {}

  async list(user: AuthUser): Promise<OrgSummary[]> {
    const rows = await this.orgs.listMine(user)
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      role: o.role,
      plan: o.plan,
      members: o.members
    }))
  }

  async create(user: AuthUser, name: unknown): Promise<OrgSummary> {
    const clean = invalid(() => cleanOrgName(name))
    const orgId = await this.orgs.create(user, clean)
    const found = (await this.list(user)).find((o) => o.id === orgId)
    if (!found) throw new UseCaseError('No se pudo crear la organización.', 'conflict')
    return found
  }

  async detail(user: AuthUser, orgId: string): Promise<OrgDetail> {
    const { actor, org } = await this.actor(user, orgId, 'data.read')
    const [members, invitations] = await Promise.all([
      this.orgs.members(user, org.id),
      can(actor, 'member.invite') ? this.orgs.invitations(user, org.id) : Promise.resolve([])
    ])
    const now = this.clock.now()
    return {
      id: org.id,
      name: org.name,
      plan: org.plan,
      me: actor.role,
      members: members.map((m) => ({ ...m, initials: initials(m.name, m.email) })),
      invitations: invitations
        .map((i) => this.view(i, now))
        .filter((i) => i.status === 'pending' || i.status === 'expired'),
      limits: { members: org.maxMembers }
    }
  }

  async rename(user: AuthUser, orgId: string, name: unknown): Promise<OrgDetail> {
    await this.actor(user, orgId, 'org.rename')
    await this.orgs.rename(
      user,
      orgId,
      invalid(() => cleanOrgName(name))
    )
    await this.orgs.audit(user, orgId, 'org.rename')
    return this.detail(user, orgId)
  }

  async remove(user: AuthUser, orgId: string, confirmName: unknown): Promise<void> {
    const { org } = await this.actor(user, orgId, 'org.delete')
    if (confirmName !== org.name) {
      throw new UseCaseError(`Escribe «${org.name}» para confirmar.`, 'invalid')
    }
    await this.orgs.audit(user, orgId, 'org.delete')
    await this.orgs.softDelete(user, orgId)
  }

  async transfer(user: AuthUser, orgId: string, newOwner: unknown): Promise<OrgDetail> {
    await this.actor(user, orgId, 'org.transfer')
    const target = id(newOwner, 'Miembro')
    if (target === user.userId) throw new UseCaseError('Ya eres el dueño.', 'invalid')
    const members = await this.orgs.members(user, orgId)
    if (!members.some((m) => m.userId === target)) {
      throw new UseCaseError('Esa persona no es miembro.', 'not-found')
    }
    await this.orgs.transfer(user, orgId, target)
    return this.detail(user, orgId)
  }

  async invite(
    user: AuthUser,
    orgId: string,
    input: { email?: unknown; role?: unknown }
  ): Promise<InviteResult> {
    const { actor, org } = await this.actor(user, orgId, 'member.invite')
    const role = this.role(input?.role)
    if (!canAssignRole(actor, role))
      throw new UseCaseError('No puedes invitar con ese rol.', 'forbidden')
    const email = invalid(() => cleanInviteEmail(input?.email))
    const members = await this.orgs.members(user, orgId)
    if (members.length >= org.maxMembers) {
      throw new UseCaseError(`El plan admite hasta ${org.maxMembers} miembros.`, 'conflict', {
        limit: org.maxMembers
      })
    }
    if (email && members.some((m) => m.email?.toLowerCase() === email)) {
      throw new UseCaseError('Esa persona ya es miembro.', 'conflict')
    }
    const token = newInviteToken()
    const invitation = await this.orgs.insertInvitation(user, {
      orgId,
      email,
      role,
      tokenHash: hashInviteToken(token),
      invitedBy: user.userId,
      expiresAt: inviteExpiry(this.clock.now())
    })
    await this.orgs.audit(user, orgId, 'member.invite', email ?? 'enlace')
    return this.deliver(user, org.name, invitation, token)
  }

  async resend(user: AuthUser, orgId: string, invitationId: string): Promise<InviteResult> {
    const { org } = await this.actor(user, orgId, 'member.invite')
    const current = await this.orgs.invitation(user, orgId, id(invitationId, 'Invitación'))
    if (!current) throw new UseCaseError('Esa invitación no existe.', 'not-found')
    const status = invitationStatus(current, this.clock.now())
    if (status === 'accepted' || status === 'revoked') {
      throw new UseCaseError('Esa invitación ya no se puede reenviar.', 'conflict')
    }
    const token = newInviteToken()
    const renewed = await this.orgs.renewInvitation(
      user,
      current.id,
      hashInviteToken(token),
      inviteExpiry(this.clock.now())
    )
    return this.deliver(user, org.name, renewed, token)
  }

  async revoke(user: AuthUser, orgId: string, invitationId: string): Promise<OrgDetail> {
    await this.actor(user, orgId, 'member.invite')
    const current = await this.orgs.invitation(user, orgId, id(invitationId, 'Invitación'))
    if (!current) throw new UseCaseError('Esa invitación no existe.', 'not-found')
    await this.orgs.revokeInvitation(user, current.id)
    await this.orgs.audit(user, orgId, 'member.revoke', current.email ?? 'enlace')
    return this.detail(user, orgId)
  }

  async preview(user: AuthUser, token: unknown): Promise<InvitePreview> {
    const inv = await this.byToken(user, token)
    if (!inv) throw new UseCaseError(ACCEPT_MESSAGE['not-found'], 'not-found')
    return {
      orgName: inv.orgName,
      role: inv.role,
      email: inv.email,
      status: invitationStatus(inv, this.clock.now())
    }
  }

  async accept(user: AuthUser, token: unknown): Promise<OrgSummary> {
    const inv = await this.byToken(user, token)
    const problem = acceptProblem(inv, user.email, this.clock.now())
    if (problem) throw this.acceptError(problem)
    let orgId: string
    try {
      orgId = await this.orgs.acceptInvitation(user, hashInviteToken(token as string))
    } catch (e) {
      const code = String((e as Error).message) as AcceptProblem | 'member-limit'
      if (code === 'member-limit')
        throw new UseCaseError('La organización está completa.', 'conflict')
      if (code in ACCEPT_MESSAGE) throw this.acceptError(code as AcceptProblem)
      throw e
    }
    const found = (await this.list(user)).find((o) => o.id === orgId)
    if (!found) throw new UseCaseError('No se pudo entrar a la organización.', 'conflict')
    return found
  }

  async changeRole(
    user: AuthUser,
    orgId: string,
    userId: unknown,
    role: unknown
  ): Promise<OrgDetail> {
    const target = await this.target(user, orgId, userId, 'member.role')
    const next = this.role(role)
    if (!canAssignRole(target.actor, next)) {
      throw new UseCaseError('Para dar la propiedad usa «Transferir».', 'forbidden')
    }
    await this.orgs.setRole(user, orgId, target.userId, next)
    await this.orgs.audit(user, orgId, 'member.role', `${target.userId}:${next}`)
    return this.detail(user, orgId)
  }

  async removeMember(user: AuthUser, orgId: string, userId: unknown): Promise<OrgDetail> {
    const target = await this.target(user, orgId, userId, 'member.remove')
    await this.orgs.removeMember(user, orgId, target.userId)
    await this.orgs.audit(user, orgId, 'member.remove', target.userId)
    return this.detail(user, orgId)
  }

  async leave(user: AuthUser, orgId: string): Promise<void> {
    await this.actor(user, orgId, 'org.leave', 'Transfiere la propiedad antes de salir.')
    await this.orgs.leave(user, orgId)
  }

  private async actor(
    user: AuthUser,
    orgId: string,
    action: OrgAction,
    deniedMessage = 'Tu rol no permite hacer esto.'
  ): Promise<{ actor: ActorRef; org: Organization }> {
    const found = await this.memberships.find(user, id(orgId, 'Organización'))
    if (!found || found.membership.status !== 'active') {
      throw new UseCaseError('No perteneces a esa organización.', 'not-found')
    }
    const actor: ActorRef = { role: found.membership.role, userId: user.userId }
    if (!can(actor, action)) throw new UseCaseError(deniedMessage, 'forbidden')
    return { actor, org: found.org }
  }

  private async target(
    user: AuthUser,
    orgId: string,
    userId: unknown,
    action: OrgAction
  ): Promise<{ actor: ActorRef; userId: string }> {
    const { actor } = await this.actor(user, orgId, action)
    const targetId = id(userId, 'Miembro')
    const member = (await this.orgs.members(user, orgId)).find((m) => m.userId === targetId)
    if (!member) throw new UseCaseError('Esa persona no es miembro.', 'not-found')
    if (!can(actor, action, { role: member.role, userId: member.userId })) {
      throw new UseCaseError('No puedes cambiar a esa persona.', 'forbidden')
    }
    return { actor, userId: targetId }
  }

  private role(value: unknown): Role {
    if (!ROLES.includes(value as Role)) throw new UseCaseError('Rol desconocido.', 'invalid')
    return value as Role
  }

  private byToken(user: AuthUser, token: unknown): Promise<InvitationRow | null> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
      throw new UseCaseError(ACCEPT_MESSAGE['not-found'], 'not-found')
    }
    return this.orgs.invitationByHash(user, hashInviteToken(token))
  }

  private acceptError(problem: AcceptProblem): UseCaseError {
    const kind =
      problem === 'not-found'
        ? 'not-found'
        : problem === 'email-mismatch'
          ? 'forbidden'
          : 'conflict'
    return new UseCaseError(ACCEPT_MESSAGE[problem], kind, { problem })
  }

  private view(inv: Invitation, now: number): OrgInvitation {
    return {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: invitationStatus(inv, now),
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt
    }
  }

  private async deliver(
    user: AuthUser,
    orgName: string,
    inv: Invitation,
    token: string
  ): Promise<InviteResult> {
    const link = `${this.publicUrl}/${INVITE_PATH}/${token}`
    let emailed = false
    if (inv.email) {
      const inviter = await this.profiles.get(user).catch(() => null)
      emailed = await this.mailer
        .sendInvite({
          to: inv.email,
          orgName,
          inviterName: inviter?.name ?? user.email,
          role: inv.role,
          link
        })
        .catch(() => false)
    }
    return { invitation: this.view(inv, this.clock.now()), link, emailed }
  }
}
