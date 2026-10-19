import type { ProviderId } from '../domain/capabilities'
import type { EmailProvider, ProviderDescriptor, ProviderInfo } from '../ports/provider'

export type CredentialSource = (id: ProviderId) => Record<string, string> | null

export interface ProviderSource {
  get(id: ProviderId): EmailProvider | null
  info(id: ProviderId): ProviderInfo | null
}

const fingerprint = (credentials: Record<string, string>): string =>
  JSON.stringify(Object.entries(credentials).sort(([a], [b]) => a.localeCompare(b)))

export class ProviderRegistry implements ProviderSource {
  private readonly cache = new Map<ProviderId, { key: string; provider: EmailProvider }>()

  constructor(
    private readonly descriptors: readonly ProviderDescriptor[],
    private readonly credentials: CredentialSource
  ) {}

  list(): readonly ProviderInfo[] {
    return this.descriptors
  }

  info(id: ProviderId): ProviderInfo | null {
    return this.descriptors.find((d) => d.id === id) ?? null
  }

  configured(id: ProviderId): boolean {
    const descriptor = this.descriptors.find((d) => d.id === id)
    const credentials = this.credentials(id)
    return Boolean(
      descriptor && credentials && descriptor.credentialKeys.every((k) => credentials[k])
    )
  }

  get(id: ProviderId): EmailProvider | null {
    const descriptor = this.descriptors.find((d) => d.id === id)
    if (!descriptor || !this.configured(id)) return null
    const credentials = this.credentials(id) as Record<string, string>
    const key = fingerprint(credentials)
    const hit = this.cache.get(id)
    if (hit?.key === key) return hit.provider
    const provider = descriptor.create(credentials)
    this.cache.set(id, { key, provider })
    return provider
  }
}
