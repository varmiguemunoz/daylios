export interface OutboundEmail {
  from?: string
  to: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  idempotencyKey?: string
}

export interface SendReceipt {
  id: string
}

export interface EmailSender {
  send(mail: OutboundEmail): Promise<SendReceipt>
}
