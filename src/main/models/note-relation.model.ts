import { EntitySchema } from 'typeorm'
import type { NoteTargetType } from '@shared/notes'

/**
 * Relación de una nota con otra nota o con un cliente.
 * Nota ↔ nota se guarda una sola vez: `noteId` = id menor, `targetId` = id mayor.
 */
export interface NoteRelation {
  id: string
  noteId: string
  targetType: NoteTargetType
  targetId: string
  createdAt: string
}

export const NoteRelationModel = new EntitySchema<NoteRelation>({
  name: 'NoteRelation',
  tableName: 'note_relations',
  columns: {
    id: { type: 'text', primary: true },
    noteId: { name: 'note_id', type: 'text' },
    targetType: { name: 'target_type', type: 'text' },
    targetId: { name: 'target_id', type: 'text' },
    createdAt: { name: 'created_at', type: 'text' }
  },
  indices: [
    { name: 'uq_note_relations', columns: ['noteId', 'targetType', 'targetId'], unique: true },
    { name: 'idx_note_relations_target', columns: ['targetType', 'targetId'] }
  ]
})
