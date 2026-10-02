import { Resend } from 'resend'
import { createResendGateway } from '../../../src/shared/resend-gateway'
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
      gateway: env.RESEND_API_KEY ? createResendGateway(env.RESEND_API_KEY) : null,
      adminToken: env.ADMIN_TOKEN ?? '',
      verifyWebhook: webhookSecret
        ? (payload, headers) =>
            new Resend(env.RESEND_API_KEY ?? 're_unused').webhooks.verify({
              payload,
              headers: {
                id: headers.get('svix-id') ?? '',
                timestamp: headers.get('svix-timestamp') ?? '',
                signature: headers.get('svix-signature') ?? ''
              },
              webhookSecret
            })
        : null
    })
  }
} satisfies ExportedHandler<Env>
