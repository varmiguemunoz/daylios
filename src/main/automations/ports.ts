import type { EntityManager } from 'typeorm'
import type { AutomationRun, ConditionGroup, NodeDef, Scope } from '@shared/automations'

export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }

export class NotConfigured extends Error {}

export class ExternalError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
  }
}

export interface EmailPort {
  send(input: { to: string; subject: string; html: string; idempotencyKey: string }): Promise<void>
  ownerEmail(): string | null
}

export interface HttpPort {
  request(input: {
    url: string
    method: string
    body: string | null
    timeoutMs: number
  }): Promise<{ status: number; body: string }>
}

export interface NotifierPort {
  notify(title: string, body: string): void
}

export interface Ports {
  email: EmailPort | null
  http: HttpPort
  notifier: NotifierPort
  clock: Clock
}

export type NodeResult =
  | { kind: 'next'; port?: string; output?: Record<string, unknown> }
  | { kind: 'wait'; until: string | null; conditions?: ConditionGroup[] }
  | { kind: 'skip'; reason: string; port?: string }
  | { kind: 'fail'; reason: string; retryable: boolean }

export interface NodeContext {
  manager: EntityManager | null
  run: AutomationRun
  node: NodeDef
  scope: Scope
  ports: Ports
  dryRun: boolean
  resumed: boolean
  idempotencyKey: string
  render(text: string, options?: { html?: boolean }): string
}

export interface NodeHandler {
  outside?: boolean
  run(ctx: NodeContext): Promise<NodeResult>
}

export type Handlers = Partial<Record<NodeDef['type'], NodeHandler>>
