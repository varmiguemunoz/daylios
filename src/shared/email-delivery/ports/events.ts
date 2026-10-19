import type { DeliveryEvent } from '../domain/events'

export interface HeaderBag {
  get(name: string): string | null
}

export interface PushEventSource {
  mode: 'push'
  parse(payload: string, headers: HeaderBag): DeliveryEvent[]
}

export interface PullEventSource {
  mode: 'pull'
  poll(cursor: string | null): Promise<{ events: DeliveryEvent[]; cursor: string | null }>
}

export type DeliveryEventSource = PushEventSource | PullEventSource
