export interface ResendContact {
  id: string
  email: string
  unsubscribed: boolean
}

export interface ResendAutomation {
  id: string
  name: string
  status: 'enabled' | 'disabled'
  createdAt: string
}

export interface ResendAutomationStep {
  key: string
  type: 'trigger' | 'delay' | 'send_email'
  config: Record<string, unknown>
}

export interface ResendAutomationDraft {
  name: string
  status: 'enabled' | 'disabled'
  steps: ResendAutomationStep[]
  connections: { from: string; to: string }[]
}

export interface ResendAutomationDetail extends ResendAutomation {
  steps: { key: string; type: string; config: Record<string, unknown> }[]
  connections: { from: string; to: string }[]
}

export interface ResendClient {
  test(): Promise<void>
  findContact(email: string): Promise<ResendContact | null>
  createContact(input: {
    email: string
    firstName?: string | null
    lastName?: string | null
    unsubscribed: boolean
    segmentIds?: string[]
  }): Promise<string>
  updateContact(
    email: string,
    patch: { firstName?: string | null; lastName?: string | null; unsubscribed?: boolean }
  ): Promise<void>
  contactSegments(email: string): Promise<{ id: string; name: string }[]>
  addToSegment(email: string, segmentId: string): Promise<void>
  removeFromSegment(email: string, segmentId: string): Promise<void>
  ensureSegment(name: string): Promise<string>
  deleteSegment(id: string): Promise<void>
  sendEvent(event: string, email: string, payload?: Record<string, unknown>): Promise<void>
  sendEmail(input: {
    from: string
    to: string
    replyTo?: string
    subject: string
    html: string
  }): Promise<string>
  sendBroadcast(input: {
    segmentId: string
    from: string
    replyTo?: string
    subject: string
    html: string
    name?: string
    scheduledAt?: string
  }): Promise<string>
  listAutomations(): Promise<ResendAutomation[]>
  getAutomation(id: string): Promise<ResendAutomationDetail>
  createAutomation(input: ResendAutomationDraft): Promise<string>
  updateAutomation(id: string, input: Partial<ResendAutomationDraft>): Promise<void>
  createTemplate(input: {
    name: string
    subject: string
    html: string
    from?: string
  }): Promise<string>
}

export type WebhookVerifier = (
  payload: string,
  headers: { get(name: string): string | null }
) => unknown
