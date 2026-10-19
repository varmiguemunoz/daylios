import { normalizeAddress } from '../../domain/names'
import type { DeliveryEvent } from '../../domain/events'
import type { PushEventSource } from '../../ports/events'
import type { WebhookVerifier } from './api'

export type ResendStatus = 'unsubscribed' | 'bounced' | 'complained'

export interface ResendWebhook {
  type?: string
  data?: Record<string, unknown>
}

export function toStatuses(event: ResendWebhook): { email: string; status: ResendStatus }[] {
  const d = event.data ?? {}
  const emails = (value: unknown): string[] =>
    (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === 'string')
      .map(normalizeAddress)

  if (event.type === 'contact.updated' && d.unsubscribed === true) {
    return emails(d.email).map((email) => ({ email, status: 'unsubscribed' }))
  }
  if (event.type === 'email.bounced') {
    const bounce = (d.bounce ?? {}) as { type?: string }
    if (bounce.type && !/permanent/i.test(bounce.type)) return []
    return emails(d.to).map((email) => ({ email, status: 'bounced' }))
  }
  if (event.type === 'email.complained')
    return emails(d.to).map((email) => ({ email, status: 'complained' }))
  return []
}

export function resendWebhookEvents(
  verify: WebhookVerifier,
  newId: () => string = () => crypto.randomUUID(),
  now: () => Date = () => new Date()
): PushEventSource {
  return {
    mode: 'push',
    parse(payload, headers): DeliveryEvent[] {
      const event = verify(payload, headers) as ResendWebhook
      const at = now().toISOString()
      return toStatuses(event).map(({ email, status }) => ({
        id: newId(),
        type: status,
        email,
        at,
        detail: { event: String(event.type) }
      }))
    }
  }
}
