import { CAPABILITIES, type Capability } from '@shared/edition'
import { canManageMembers, isActive, type Membership, type Organization } from './membership'

export function capabilitiesFor(org: Organization | null, m: Membership | null): Capability[] {
  if (!org || !isActive(m)) return []
  return CAPABILITIES.filter((c) => c !== 'org.invite' || canManageMembers(m))
}

export const memberLimit = (org: Organization | null): number => org?.maxMembers ?? 0
