import { EntitySchema } from 'typeorm'
import { ALIVE, DELETED_AT, type SoftDeletable } from './soft-delete'
import type { ContactEvent, LeadSource, Newsletter, Rule, Tag } from '@shared/marketing'

export const TagModel = new EntitySchema<Tag & SoftDeletable>({
  name: 'Tag',
  tableName: 'tags',
  columns: {
    id: { type: 'text', primary: true },
    slug: { type: 'text' },
    name: { type: 'text' },
    segmentId: { name: 'segment_id', type: 'text', nullable: true },
    audience: { type: 'boolean', default: false },
    createdAt: { name: 'created_at', type: 'text' },
    deletedAt: DELETED_AT
  },
  indices: [{ name: 'uq_tags_slug', columns: ['slug'], unique: true, where: ALIVE }]
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

export const LeadSourceModel = new EntitySchema<LeadSource & SoftDeletable>({
  name: 'LeadSource',
  tableName: 'lead_sources',
  columns: {
    id: { type: 'text', primary: true },
    slug: { type: 'text' },
    name: { type: 'text' },
    secret: { type: 'text' },
    defaultTags: { name: 'default_tags', type: 'simple-json', default: '[]' },
    receivedCount: { name: 'received_count', type: 'integer', default: 0 },
    lastReceivedAt: { name: 'last_received_at', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' },
    deletedAt: DELETED_AT
  },
  indices: [{ name: 'uq_lead_sources_slug', columns: ['slug'], unique: true, where: ALIVE }]
})

export const RuleModel = new EntitySchema<Rule & SoftDeletable>({
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
    updatedAt: { name: 'updated_at', type: 'text' },
    deletedAt: DELETED_AT
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

export interface OutboxJob {
  id: string

  kind: 'contact' | 'event' | 'segment_delete'
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
