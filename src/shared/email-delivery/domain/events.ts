export const DELIVERY_EVENT_TYPES = [
  'unsubscribed',
  'bounced',
  'complained',
  'replied',
  'delivered'
] as const
export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number]

export interface DeliveryEvent {
  id: string
  type: DeliveryEventType
  email: string
  at: string
  detail?: Record<string, string | number | boolean | null>
}

export const SUPPRESSING_EVENTS: readonly DeliveryEventType[] = [
  'unsubscribed',
  'bounced',
  'complained'
]
