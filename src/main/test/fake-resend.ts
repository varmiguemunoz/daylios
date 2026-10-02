import { randomUUID } from 'crypto'
import {
  ResendError,
  type AutomationDraft,
  type RemoteAutomation,
  type RemoteAutomationDetail,
  type RemoteContact,
  type ResendGateway
} from '@shared/resend-gateway'

/** Resend en memoria para tests. `failNext` hace fallar la próxima llamada con ese código. */
export class FakeResend implements ResendGateway {
  contacts = new Map<
    string,
    {
      id: string
      email: string
      unsubscribed: boolean
      firstName?: string | null
      segments: Set<string>
    }
  >()
  segments = new Map<string, string>() // id → nombre
  events: { event: string; email: string; payload?: Record<string, unknown> }[] = []
  emails: { from: string; to: string; subject: string; html: string }[] = []
  broadcasts: {
    id: string
    segmentId: string
    subject: string
    html: string
    scheduledAt?: string
  }[] = []
  automations = new Map<string, RemoteAutomationDetail>()
  templates = new Map<string, { name: string; subject: string; html: string }>()
  calls = 0
  private failure: string | null = null

  failNext(code = 'internal_server_error'): void {
    this.failure = code
  }

  private hit(): void {
    this.calls++
    if (this.failure) {
      const code = this.failure
      this.failure = null
      throw new ResendError(`Fallo simulado (${code})`, code, 500)
    }
  }

  async test(): Promise<void> {
    this.hit()
  }

  async findContact(email: string): Promise<RemoteContact | null> {
    this.hit()
    const c = this.contacts.get(email)
    return c ? { id: c.id, email: c.email, unsubscribed: c.unsubscribed } : null
  }

  async createContact(input: Parameters<ResendGateway['createContact']>[0]): Promise<string> {
    this.hit()
    const id = randomUUID()
    this.contacts.set(input.email, {
      id,
      email: input.email,
      unsubscribed: input.unsubscribed,
      firstName: input.firstName,
      segments: new Set(input.segmentIds ?? [])
    })
    return id
  }

  async updateContact(
    email: string,
    patch: Parameters<ResendGateway['updateContact']>[1]
  ): Promise<void> {
    this.hit()
    const c = this.contacts.get(email)
    if (!c) throw new ResendError('Contact not found', 'not_found', 404)
    if (patch.unsubscribed !== undefined) c.unsubscribed = patch.unsubscribed
    if (patch.firstName !== undefined) c.firstName = patch.firstName
  }

  async contactSegments(email: string): Promise<{ id: string; name: string }[]> {
    this.hit()
    const c = this.contacts.get(email)
    return [...(c?.segments ?? [])].map((id) => ({ id, name: this.segments.get(id) ?? '' }))
  }

  async addToSegment(email: string, segmentId: string): Promise<void> {
    this.hit()
    this.contacts.get(email)?.segments.add(segmentId)
  }

  async removeFromSegment(email: string, segmentId: string): Promise<void> {
    this.hit()
    this.contacts.get(email)?.segments.delete(segmentId)
  }

  async ensureSegment(name: string): Promise<string> {
    this.hit()
    for (const [id, n] of this.segments) if (n === name) return id
    const id = randomUUID()
    this.segments.set(id, name)
    return id
  }

  async sendEvent(event: string, email: string, payload?: Record<string, unknown>): Promise<void> {
    this.hit()
    this.events.push({ event, email, payload })
  }

  async sendEmail(input: {
    from: string
    to: string
    subject: string
    html: string
  }): Promise<string> {
    this.hit()
    this.emails.push(input)
    return randomUUID()
  }

  async sendBroadcast(input: Parameters<ResendGateway['sendBroadcast']>[0]): Promise<string> {
    this.hit()
    const id = randomUUID()
    this.broadcasts.push({ id, ...input })
    return id
  }

  async listAutomations(): Promise<RemoteAutomation[]> {
    this.hit()
    return [...this.automations.values()].map(({ id, name, status, createdAt }) => ({
      id,
      name,
      status,
      createdAt
    }))
  }

  async getAutomation(id: string): Promise<RemoteAutomationDetail> {
    this.hit()
    const a = this.automations.get(id)
    if (!a) throw new ResendError('Automation not found', 'not_found', 404)
    return a
  }

  async createAutomation(input: AutomationDraft): Promise<string> {
    this.hit()
    const id = randomUUID()
    this.automations.set(id, { id, createdAt: new Date().toISOString(), ...input })
    return id
  }

  async updateAutomation(id: string, input: Partial<AutomationDraft>): Promise<void> {
    this.hit()
    const a = this.automations.get(id)
    if (!a) throw new ResendError('Automation not found', 'not_found', 404)
    Object.assign(a, input)
  }

  async createTemplate(input: { name: string; subject: string; html: string }): Promise<string> {
    this.hit()
    const id = randomUUID()
    this.templates.set(id, input)
    return id
  }
}
