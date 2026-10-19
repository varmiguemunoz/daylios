import {
  DEFAULT_ROLES,
  DeliveryRouter,
  type EmailProvider,
  type RoleAssignment
} from '@shared/email-delivery'
import type { ResendClient } from '@shared/email-delivery/providers/resend/api'
import { RESEND_INFO, resendProvider } from '@shared/email-delivery/providers/resend/provider'

export function routerWith(
  providers: EmailProvider[],
  roles: RoleAssignment = DEFAULT_ROLES
): DeliveryRouter {
  return new DeliveryRouter(
    {
      get: (id) => providers.find((p) => p.id === id) ?? null,
      info: (id) => providers.find((p) => p.id === id) ?? (id === 'resend' ? RESEND_INFO : null)
    },
    () => roles
  )
}

export const routerFor = (client: ResendClient | null, roles?: RoleAssignment): DeliveryRouter =>
  routerWith(client ? [resendProvider(client)] : [], roles)
