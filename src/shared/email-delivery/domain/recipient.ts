import type { DeliveryRole } from './capabilities'

export type RecipientStatus = 'none' | 'subscribed' | 'unsubscribed' | 'bounced' | 'complained'

export interface Recipient {
  email: string | null
  status: RecipientStatus
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

const SUPPRESSED: readonly RecipientStatus[] = ['unsubscribed', 'bounced', 'complained']

export const isSuppressed = (status: RecipientStatus): boolean => SUPPRESSED.includes(status)

export function canReceive(role: DeliveryRole, recipient: Recipient): Eligibility {
  if (!recipient.email) return { ok: false, reason: 'El contacto no tiene email.' }
  if (role === 'transactional') return { ok: true }
  if (role === 'marketing') {
    return recipient.status === 'subscribed'
      ? { ok: true }
      : { ok: false, reason: 'El contacto no está suscrito.' }
  }
  return isSuppressed(recipient.status)
    ? { ok: false, reason: 'El contacto se dio de baja, rebotó o se quejó.' }
    : { ok: true }
}
