import { ACTIVITY_PAGE, type ActivityPage } from '@shared/activity'
import { isActive } from '../domain/membership'
import type { AuthUser, MembershipRepository, SyncStore } from '../ports'
import { UseCaseError } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ReadActivity {
  constructor(
    private readonly store: SyncStore,
    private readonly memberships: MembershipRepository
  ) {}

  async list(user: AuthUser, orgId: string, since: unknown): Promise<ActivityPage> {
    if (typeof orgId !== 'string' || !UUID.test(orgId))
      throw new UseCaseError('Organización inválida.', 'invalid')
    const found = await this.memberships.find(user, orgId)
    if (!isActive(found?.membership ?? null))
      throw new UseCaseError('No perteneces a esa organización.', 'not-found')
    const from = Number.isSafeInteger(Number(since)) && Number(since) >= 0 ? Number(since) : 0
    const page = await this.store.activity(user, orgId, from, ACTIVITY_PAGE + 1)
    const more = page.length > ACTIVITY_PAGE
    const items = more ? page.slice(0, ACTIVITY_PAGE) : page
    return { items, cursor: items.length ? items[items.length - 1].seq : from, more }
  }
}
