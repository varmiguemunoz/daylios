import { can, type Role } from '@shared/organizations'

export { ROLES, type Role } from '@shared/organizations'

export interface Membership {
  orgId: string
  userId: string
  role: Role
  status: 'active' | 'removed'
}

export interface Organization {
  id: string
  name: string
  plan: string
  maxMembers: number
}

export const isActive = (m: Membership | null): m is Membership => m?.status === 'active'

export const canManageMembers = (m: Membership | null): boolean =>
  isActive(m) && can(m, 'member.invite')

export const canWrite = (m: Membership | null): boolean => isActive(m) && can(m, 'data.write')
