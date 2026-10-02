import type { LeadPayload, Rule } from './marketing'

/**
 * Contrato entre la app y el Worker `leads-hub` (Cloudflare). Solo tipos.
 * La app empuja la config (`PUT /admin/config`) y descarga la cola (`GET /admin/inbox`).
 */

export interface HubSource {
  slug: string
  name: string
  /** SHA-256 (hex) del secreto. El Worker nunca guarda el secreto en claro. */
  secretHash: string
  defaultTags: string[]
}

export interface HubConfig {
  sources: HubSource[]
  rules: Rule[]
  /** slug del tag → id del Segment en Resend. Lo completan la app y el Worker. */
  segments: Record<string, string>
}

/** Resultado de lo que el Worker hizo en Resend al recibir un lead. */
export interface HubResendResult {
  ok: boolean
  error: string | null
  /** El contacto no existía en Resend y se creó. */
  created: boolean
  /** El contacto ya estaba dado de baja en Resend (no se reactivó ni recibió eventos). */
  unsubscribed: boolean
  /** Segments usados (slug → id), para que la app los recuerde. */
  segments: Record<string, string>
}

export interface HubLeadItem {
  id: string
  kind: 'lead'
  receivedAt: string
  source: string
  lead: LeadPayload
  /** Tags que entraron (origen + por defecto + payload + reglas). */
  added: string[]
  /** Tags que las reglas quitaron. */
  removed: string[]
  /** Eventos de reglas (`fire_event`). */
  events: string[]
  /** Etapa de pipeline pedida por una regla, o null. */
  promote: string | null
  resend: HubResendResult
}

export type HubStatus = 'unsubscribed' | 'bounced' | 'complained'

export interface HubStatusItem {
  id: string
  kind: 'status'
  receivedAt: string
  email: string
  status: HubStatus
  /** Tipo de webhook de Resend que lo originó. */
  event: string
}

export type HubItem = HubLeadItem | HubStatusItem

export interface HubHealth {
  ok: true
  sources: number
  rules: number
  queued: number
  resend: boolean
  webhooks: boolean
}
