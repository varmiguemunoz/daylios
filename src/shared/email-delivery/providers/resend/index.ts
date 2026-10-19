import type { EmailProvider, ProviderDescriptor } from '../../ports/provider'
import { createResendClient, createResendWebhookVerifier } from './client'
import { RESEND_INFO, resendProvider } from './provider'

export type { ResendClient } from './api'
export { createResendClient, createResendWebhookVerifier } from './client'
export { RESEND_INFO, RESEND_LIMITS, resendProvider } from './provider'
export { resendWebhookEvents, toStatuses } from './events'
export { resendError } from './errors'
export { buildDraft } from './sequences'

export function createResendProvider(credentials: {
  apiKey: string
  webhookSecret?: string
}): EmailProvider {
  return resendProvider(createResendClient(credentials.apiKey), {
    verify: credentials.webhookSecret
      ? createResendWebhookVerifier(credentials.webhookSecret, credentials.apiKey)
      : undefined
  })
}

export const resendDescriptor: ProviderDescriptor = {
  ...RESEND_INFO,
  create: (credentials) =>
    createResendProvider({
      apiKey: credentials.apiKey,
      webhookSecret: credentials.webhookSecret || undefined
    })
}
