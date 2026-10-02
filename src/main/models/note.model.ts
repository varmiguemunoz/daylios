import { EntitySchema } from 'typeorm'
import type { Note } from '@shared/notes'

/** Modelo de la tabla `notes`. El título no se guarda: sale de la primera línea del cuerpo. */
export const NoteModel = new EntitySchema<Note>({
  name: 'Note',
  tableName: 'notes',
  columns: {
    id: { type: 'text', primary: true },
    body: { type: 'text' },
    date: { type: 'text' },
    createdAt: { name: 'created_at', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'text' }
  },
  indices: [{ name: 'idx_notes_date', columns: ['date', 'updatedAt'] }]
})
