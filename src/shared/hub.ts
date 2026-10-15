import type { LeadPayload } from './marketing'

export interface HubSource {
  slug: string
  name: string

  secretHash: string
  defaultTags: string[]
}

export interface HubConfig {
  sources: HubSource[]

  segments: Record<string, string>

  audience?: string[]
}

export interface HubResendResult {
  ok: boolean
  error: string | null

  created: boolean

  unsubscribed: boolean

  segments: Record<string, string>
}

export interface HubLeadItem {
  id: string
  kind: 'lead'
  receivedAt: string
  source: string
  lead: LeadPayload

  added: string[]

  removed: string[]

  events: string[]

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

  event: string
}

export type HubItem = HubLeadItem | HubStatusItem

export interface HubHealth {
  ok: true
  sources: number
  queued: number
  resend: boolean
  webhooks: boolean
}
