import type { EntitySchemaColumnOptions } from 'typeorm'

export interface SoftDeletable {
  deletedAt?: string | null
}

export const DELETED_AT: EntitySchemaColumnOptions = {
  name: 'deleted_at',
  type: 'text',
  nullable: true,
  deleteDate: true
}

export const ALIVE = 'deleted_at IS NULL'
