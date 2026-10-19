import type { SendReceipt } from './sender'

export interface BroadcastInput {
  groupId: string
  from?: string
  replyTo?: string
  subject: string
  html: string
  name?: string
  scheduledAt?: string
}

export interface BroadcastSender {
  send(input: BroadcastInput): Promise<SendReceipt>
}
