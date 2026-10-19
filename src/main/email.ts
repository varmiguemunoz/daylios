import {
  DeliveryRouter,
  ProviderRegistry,
  checkRoles,
  type ProviderId
} from '@shared/email-delivery'
import { apolloDescriptor } from '@shared/email-delivery/providers/apollo'
import { resendDescriptor } from '@shared/email-delivery/providers/resend'
import { config, setRoleValidator } from './config'

const KEYS: Record<ProviderId, () => string> = {
  resend: () => config.resendKey(),
  apollo: () => config.apolloKey()
}

const credentials = (id: ProviderId): Record<string, string> | null => {
  const key = KEYS[id]()
  return key ? { apiKey: key } : null
}

export const providerRegistry = new ProviderRegistry(
  [resendDescriptor, apolloDescriptor({ footer: () => config.outreachFooter() })],
  credentials
)

export const deliveryRouter = new DeliveryRouter(providerRegistry, () => config.emailRoles())

setRoleValidator((roles) => checkRoles(roles, (id) => providerRegistry.info(id)))
