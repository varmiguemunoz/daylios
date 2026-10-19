import type { Capability, ProviderId, ProviderLimits, ProviderPolicy } from '../domain/capabilities'
import type { AudienceStore } from './audience'
import type { BroadcastSender } from './broadcasts'
import type { DeliveryEventSource } from './events'
import type { EmailSender } from './sender'
import type { SequenceEngine } from './sequences'

export interface ProviderInfo {
  id: ProviderId
  label: string
  policy: ProviderPolicy
  credentialKeys: readonly string[]
  capabilities: readonly Capability[]
}

export interface EmailProvider extends ProviderInfo {
  limits: ProviderLimits
  test(): Promise<void>
  sender?: EmailSender
  audience?: AudienceStore
  sequences?: SequenceEngine
  broadcasts?: BroadcastSender
  events?: DeliveryEventSource
}

export interface ProviderDescriptor extends ProviderInfo {
  create(credentials: Record<string, string>): EmailProvider
}

const PORT_OF: Record<Capability, keyof EmailProvider> = {
  send: 'sender',
  audience: 'audience',
  sequences: 'sequences',
  broadcasts: 'broadcasts',
  events: 'events'
}

export const portOf = (capability: Capability): keyof EmailProvider => PORT_OF[capability]

export const capabilitiesOf = (provider: EmailProvider): Capability[] =>
  (Object.keys(PORT_OF) as Capability[]).filter((c) => Boolean(provider[PORT_OF[c]]))
