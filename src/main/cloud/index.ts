import type { CloudAdapters, IdentityPort } from '../ports'
import { localAdapters } from '../ports/local'
import { ServerEntitlements } from './entitlements'

export async function createCloudAdapters(identity?: IdentityPort): Promise<CloudAdapters> {
  const base = localAdapters()
  const entitlements = new ServerEntitlements(async () => [])
  await entitlements.refresh()
  return { ...base, edition: 'team', identity: identity ?? base.identity, entitlements }
}
