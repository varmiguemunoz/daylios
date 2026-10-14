import type { EntitlementsResponse } from '@shared/sync-protocol'
import { capabilitiesFor, memberLimit } from '../domain/entitlements'
import type { AuthUser, Clock, MembershipRepository } from '../ports'

/** La app pide cada 15 minutos qué puede usar en una organización (ver ServerEntitlements). */
export const ENTITLEMENTS_TTL_MS = 15 * 60_000

export class GetEntitlements {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly clock: Clock
  ) {}

  async execute(user: AuthUser, orgId: string): Promise<EntitlementsResponse> {
    const found = await this.memberships.find(user, orgId)
    return {
      orgId,
      capabilities: capabilitiesFor(found?.org ?? null, found?.membership ?? null),
      limits: { members: memberLimit(found?.org ?? null) },
      validUntil: new Date(this.clock.now() + ENTITLEMENTS_TTL_MS).toISOString()
    }
  }
}
