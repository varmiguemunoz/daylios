import type { Edition, EditionStatus } from '@shared/edition'
import type { CloudAdapters, IdentityPort } from './ports'
import { localAdapters } from './ports/local'

let adapters: CloudAdapters = localAdapters()

export async function loadEdition(
  edition: Edition,
  identity?: IdentityPort
): Promise<CloudAdapters> {
  await adapters.sync.stop()
  if (edition === 'team') {
    const { createCloudAdapters } = await import('./cloud')
    adapters = await createCloudAdapters(identity)
  } else {
    adapters = localAdapters()
  }
  return adapters
}

export const cloud = (): CloudAdapters => adapters

export const editionStatus = (): EditionStatus => ({
  edition: adapters.edition,
  capabilities: adapters.entitlements.list()
})
