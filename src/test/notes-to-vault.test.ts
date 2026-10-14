import { readdirSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import type { WorkspaceService } from '../main/services/workspace.service'
import { NoteService } from '../main/services/note.service'
import { moveNotesToVault } from '../main/services/notes-to-vault'
import { tempWorkspace } from '../main/test/workspace'

describe('moveNotesToVault', () => {
  let db: DataSource
  let root: string
  let ws: WorkspaceService

  beforeEach(async () => {
    ;({ db, root, workspace: ws } = await tempWorkspace())
    const insert =
      'INSERT INTO notes (id, body, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    await db.query(insert, [
      'n1',
      '# Idea webinar\n\nGrabar el lunes',
      '2026-10-01',
      '2026-10-01T15:00:00.000Z',
      '2026-10-02T10:00:00.000Z'
    ])
    await db.query(insert, [
      'n2',
      '# Reunión Acme',
      '2026-10-05',
      '2026-10-05T18:00:00.000Z',
      '2026-10-05T18:30:00.000Z'
    ])
    await db.query(
      "INSERT INTO note_relations (id, note_id, target_type, target_id, created_at) VALUES ('r1', 'n1', 'note', 'n2', '2026-10-05')"
    )
  })
  afterEach(() => db.destroy())

  it('crea los archivos con su fecha, conserva ids y relaciones, y deja la tabla de respaldo', async () => {
    expect(await moveNotesToVault(db, ws)).toBe(2)
    expect(readdirSync(join(root, 'Notas rápidas')).sort()).toEqual([
      'Idea webinar.md',
      'Reunión Acme.md'
    ])
    const notes = new NoteService(db, ws)
    const view = await notes.view('n1')
    expect(view.note.date).toBe('2026-10-01')
    expect(view.related.map((n) => n.title)).toEqual(['Reunión Acme'])
    const legacy = await db.query("SELECT name FROM sqlite_master WHERE name = 'notes_legacy'")
    expect(legacy).toHaveLength(1)
  })

  it('es idempotente: si se corta a medias no duplica', async () => {
    await ws.quickNotesFolder()
    await ws.createNoteAt('Notas rápidas', 'Idea webinar', '# Idea webinar', {
      id: 'n1'
    })
    expect(await moveNotesToVault(db, ws)).toBe(1)
    expect(readdirSync(join(root, 'Notas rápidas'))).toHaveLength(2)
    expect(await moveNotesToVault(db, ws)).toBe(0)
  })
})
