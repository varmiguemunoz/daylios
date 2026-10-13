import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { NoteService } from './note.service'
import { memoryDb } from '../test/helpers'

describe('NoteService · relaciones', () => {
  let db: DataSource
  let notes: NoteService

  beforeEach(async () => {
    db = await memoryDb()
    notes = new NoteService(db)
  })
  afterEach(() => db.destroy())

  it('relacionar A con B se ve desde las dos y no se duplica', async () => {
    const a = await notes.create('# A')
    const b = await notes.create('# B')
    await notes.link(a.id, { type: 'note', id: b.id })
    await notes.link(b.id, { type: 'note', id: a.id })
    expect((await notes.view(a.id)).related.map((n) => n.title)).toEqual(['B'])
    expect((await notes.view(b.id)).related.map((n) => n.title)).toEqual(['A'])
  })

  it('no se relaciona consigo misma; borrar B la quita de A', async () => {
    const a = await notes.create('# A')
    const b = await notes.create('# B')
    await expect(notes.link(a.id, { type: 'note', id: a.id })).rejects.toThrow()
    await notes.link(a.id, { type: 'note', id: b.id })
    await notes.remove(b.id)
    expect((await notes.view(a.id)).related).toEqual([])
  })

  it('busca sin acentos', async () => {
    await notes.create('# Reunión con Acme')
    expect((await notes.search('reunion'))[0].title).toBe('Reunión con Acme')
  })
})
