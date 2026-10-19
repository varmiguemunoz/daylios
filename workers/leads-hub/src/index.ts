import {
  createResendProvider,
  createResendWebhookVerifier,
  resendWebhookEvents
} from '../../../src/shared/email-delivery/providers/resend'
import { handle } from './hub'
import { D1Store } from './store'

/**
 * Worker `leads-hub`: recibe leads y webhooks de Resend aunque el Mac esté apagado.
 * Secretos (wrangler secret put): RESEND_API_KEY, ADMIN_TOKEN, RESEND_WEBHOOK_SECRET.
 */
export interface Env {
  DB: D1Database
  RESEND_API_KEY?: string
  ADMIN_TOKEN?: string
  RESEND_WEBHOOK_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const webhookSecret = env.RESEND_WEBHOOK_SECRET
    return handle(request, {
      store: new D1Store(env.DB),
      provider: env.RESEND_API_KEY ? createResendProvider({ apiKey: env.RESEND_API_KEY }) : null,
      adminToken: env.ADMIN_TOKEN ?? '',
      events: webhookSecret
        ? resendWebhookEvents(createResendWebhookVerifier(webhookSecret, env.RESEND_API_KEY))
        : null
    })
  }
} satisfies ExportedHandler<Env>
