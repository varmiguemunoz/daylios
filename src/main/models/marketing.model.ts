import { EntitySchema } from 'typeorm'
import type { ContactEvent, LeadSource, Newsletter, Rule, Tag } from '@shared/marketing'

/** Modelos del email marketing (ver migración AddMarketing). */

export const TagModel = new EntitySchema<Tag>({
  name: 'Tag',
  tableName: 'tags',
  columns: {
    id: { type: 'text', primary: true },
    slug: { type: 'text', unique: true },
    name: { type: 'text' },
    segmentId: { name: 'segment_id', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' }
  }
})

export interface ContactTag {
  contactId: string
  tagId: string
  createdAt: string
}

export const ContactTagModel = new EntitySchema<ContactTag>({
  name: 'ContactTag',
  tableName: 'contact_tags',
  columns: {
    contactId: { name: 'contact_id', type: 'text', primary: true },
    tagId: { name: 'tag_id', type: 'text', primary: true },
    createdAt: { name: 'created_at', type: 'text' }
  },
  indices: [{ name: 'idx_contact_tags_tag', columns: ['tagId'] }]
})

export const ContactEventModel = new EntitySchema<ContactEvent>({
  name: 'ContactEvent',
  tableName: 'contact_events',
  columns: {
    id: { type: 'text', primary: true },
    contactId: { name: 'contact_id', type: 'text' },
    type: { type: 'text' },
    detail: { type: 'simple-json', default: '{}' },
    createdAt: { name: 'created_at', type: 'text' }
  },
  indices: [{ name: 'idx_contact_events_contact', columns: ['contactId', 'createdAt'] }]
})

export const LeadSourceModel = new EntitySchema<LeadSource>({
  name: 'LeadSource',
  tableName: 'lead_sources',
  columns: {
    id: { type: 'text', primary: true },
    slug: { type: 'text', unique: true },
    name: { type: 'text' },
    secret: { type: 'text' },
    defaultTags: { name: 'default_tags', type: 'simple-json', default: '[]' },
    receivedCount: { name: 'received_count', type: 'integer', default: 0 },
    lastReceivedAt: { name: 'last_received_at', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  }
})

export const RuleModel = new EntitySchema<Rule>({
  name: 'Rule',
  tableName: 'rules',
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    position: { type: 'integer', default: 0 },
    active: { type: 'boolean', default: true },
    triggerTag: { name: 'trigger_tag', type: 'text' },
    actions: { type: 'simple-json', default: '[]' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  }
})

export const NewsletterModel = new EntitySchema<Newsletter>({
  name: 'Newsletter',
  tableName: 'newsletters',
  columns: {
    id: { type: 'text', primary: true },
    day: { type: 'text' },
    tag: { type: 'text' },
    subject: { type: 'text' },
    html: { type: 'text' },
    status: { type: 'text' },
    broadcastId: { name: 'broadcast_id', type: 'text', nullable: true },
    error: { type: 'text', nullable: true },
    scheduledAt: { name: 'scheduled_at', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [{ name: 'idx_newsletters_day', columns: ['day'] }]
})

/**
 * Trabajo pendiente hacia Resend. `contact` = sincronizar un contacto (uno pendiente por
 * contacto); `event` = disparar un evento (`payload.event`) para el contacto `ref`.
 */
export interface OutboxJob {
  id: string
  kind: 'contact' | 'event'
  ref: string
  payload: Record<string, unknown>
  attempts: number
  lastError: string | null
  nextAt: string
  createdAt: string
}

export const OutboxModel = new EntitySchema<OutboxJob>({
  name: 'OutboxJob',
  tableName: 'resend_outbox',
  columns: {
    id: { type: 'text', primary: true },
    kind: { type: 'text' },
    ref: { type: 'text' },
    payload: { type: 'simple-json', default: '{}' },
    attempts: { type: 'integer', default: 0 },
    lastError: { name: 'last_error', type: 'text', nullable: true },
    nextAt: { name: 'next_at', type: 'text' },
    createdAt: { name: 'created_at', type: 'text' }
  },
  indices: [{ name: 'idx_outbox_next', columns: ['nextAt'] }]
})

/** Items de la cola del Worker ya aplicados (hace idempotente reprocesarlos). */
export interface HubReceipt {
  id: string
  processedAt: string
}

export const HubReceiptModel = new EntitySchema<HubReceipt>({
  name: 'HubReceipt',
  tableName: 'hub_receipts',
  columns: {
    id: { type: 'text', primary: true },
    processedAt: { name: 'processed_at', type: 'text' }
  }
})
