export type Role = 'owner' | 'admin' | 'member' | 'viewer'
export const ROLES: Role[] = ['owner', 'admin', 'member', 'viewer']
export const INVITABLE_ROLES: Role[] = ['admin', 'member', 'viewer']

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueño',
  admin: 'Admin',
  member: 'Miembro',
  viewer: 'Solo lectura'
}

export const INVITE_TTL_DAYS = 7
export const INVITE_PATH = 'invite'

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface OrgSummary {
  id: string
  name: string
  role: Role
  plan: string
  members: number
}

export interface OrgMember {
  userId: string
  name: string | null
  email: string | null
  initials: string
  role: Role
}

export interface OrgInvitation {
  id: string
  email: string | null
  role: Role
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface OrgDetail {
  id: string
  name: string
  plan: string
  me: Role
  members: OrgMember[]
  invitations: OrgInvitation[]
  limits: { members: number }
}

export interface InviteInput {
  email?: string | null
  role: Role
}

export interface InviteResult {
  invitation: OrgInvitation
  link: string
  emailed: boolean
}

export interface InvitePreview {
  orgName: string
  role: Role
  email: string | null
  status: InvitationStatus
}

export interface ActiveWorkspace {
  orgId: string | null
  name: string
}

export interface Authorship {
  createdBy: string | null
  updatedBy: string | null
}

export interface OrgsState {
  active: ActiveWorkspace
  orgs: OrgSummary[]
  notice: string | null
}

export interface OrgsApi {
  state(): Promise<OrgsState>
  refresh(): Promise<OrgsState>
  create(name: string, bringLocal?: boolean): Promise<OrgsState>
  switchTo(orgId: string | null): Promise<void>
  detail(): Promise<OrgDetail | null>
  rename(name: string): Promise<OrgDetail>
  remove(confirmName: string): Promise<void>
  transfer(userId: string): Promise<OrgDetail>
  invite(input: InviteInput): Promise<InviteResult>
  resendInvite(id: string): Promise<InviteResult>
  revokeInvite(id: string): Promise<OrgDetail>
  changeRole(userId: string, role: Role): Promise<OrgDetail>
  removeMember(userId: string): Promise<OrgDetail>
  leave(): Promise<void>
  members(): Promise<OrgMember[]>
  authorship(table: string, id: string): Promise<Authorship>
  onChanged(cb: (state: OrgsState) => void): () => void
}

export type OrgAction =
  | 'org.rename'
  | 'org.delete'
  | 'org.transfer'
  | 'member.invite'
  | 'member.remove'
  | 'member.role'
  | 'org.leave'
  | 'data.read'
  | 'data.write'

export interface ActorRef {
  role: Role
  userId: string
}

export function can(actor: ActorRef | null, action: OrgAction, target?: ActorRef): boolean {
  if (!actor) return false
  const { role } = actor
  switch (action) {
    case 'data.read':
      return true
    case 'data.write':
      return role !== 'viewer'
    case 'org.rename':
    case 'org.delete':
    case 'org.transfer':
      return role === 'owner'
    case 'member.invite':
      return role === 'owner' || role === 'admin'
    case 'member.remove':
    case 'member.role':
      if (role !== 'owner' && role !== 'admin') return false
      if (!target) return true
      if (target.role === 'owner') return false
      return target.userId !== actor.userId
    case 'org.leave':
      return role !== 'owner'
  }
}

export const canAssignRole = (actor: ActorRef | null, role: Role): boolean =>
  !!actor && role !== 'owner' && (actor.role === 'owner' || actor.role === 'admin')
