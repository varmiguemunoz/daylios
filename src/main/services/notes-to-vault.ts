import type { DataSource } from 'typeorm'
import { QUICK_NOTES } from '@shared/workspace'
import { WorkspaceItemModel } from '../models/workspace.model'
import { noteFileName } from '@shared/notes'
import type { WorkspaceService } from './workspace.service'

interface LegacyNote {
  id: string
  body: string
  date: string
  createdAt: string
  updatedAt: string
}

export async function moveNotesToVault(
  db: DataSource,
  workspace: WorkspaceService
): Promise<number> {
  const table = await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'"
  )
  if (!table.length) return 0

  const notes: LegacyNote[] = await db.query(
    'SELECT id, body, date, created_at AS createdAt, updated_at AS updatedAt FROM notes ORDER BY created_at'
  )
  await workspace.quickNotesFolder()
  const index = db.getRepository(WorkspaceItemModel)
  let moved = 0
  for (const note of notes) {
    if (await index.findOneBy({ id: note.id })) continue // ya migrada en un arranque anterior
    await workspace.createNoteAt(QUICK_NOTES, noteFileName(note.body), note.body, {
      id: note.id,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    })
    moved++
  }

  const legacy = await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes_legacy'"
  )
  if (!legacy.length) await db.query('ALTER TABLE notes RENAME TO notes_legacy')
  return moved
}
