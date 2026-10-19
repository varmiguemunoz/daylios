export const PROVIDER_IDS = ['resend', 'apollo'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export const DELIVERY_ROLES = ['transactional', 'marketing', 'outreach'] as const
export type DeliveryRole = (typeof DELIVERY_ROLES)[number]

export const CAPABILITIES = ['send', 'audience', 'sequences', 'broadcasts', 'events'] as const
export type Capability = (typeof CAPABILITIES)[number]

export interface ProviderPolicy {
  coldOutreach: boolean
  sender: 'domain' | 'mailbox'
}

export interface ProviderLimits {
  minIntervalMs: number
  dailyCap: number | null
}

export type RoleAssignment = Partial<Record<DeliveryRole, ProviderId>>

export const DEFAULT_ROLES: Readonly<RoleAssignment> = {
  transactional: 'resend',
  marketing: 'resend'
}

export const ROLE_LABEL: Record<DeliveryRole, string> = {
  transactional: 'correos transaccionales',
  marketing: 'marketing',
  outreach: 'outreach en frío'
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  send: 'envío de correos',
  audience: 'contactos y grupos',
  sequences: 'secuencias',
  broadcasts: 'envíos masivos',
  events: 'eventos de entrega'
}

export const isProviderId = (value: unknown): value is ProviderId =>
  PROVIDER_IDS.includes(value as ProviderId)

export const isDeliveryRole = (value: unknown): value is DeliveryRole =>
  DELIVERY_ROLES.includes(value as DeliveryRole)
