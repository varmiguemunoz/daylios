import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { NoteService } from './note.service'
import { tempWorkspace } from '../test/workspace'

describe('NoteService · notas en la bóveda', () => {
  let db: DataSource
  let root: string
  let notes: NoteService

  beforeEach(async () => {
    const t = await tempWorkspace()
    db = t.db
    root = t.root
    notes = new NoteService(db, t.workspace)
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

  it('las notas son archivos de «Notas rápidas»; settle renombra según el título', async () => {
    const note = await notes.create('')
    expect(note.path).toBe('Notas rápidas/Sin título.md')
    await notes.update(note.id, '# Plan de ventas\n\nLlamar a 10', note.updatedAt)
    const settled = await notes.settle(note.id)
    expect(settled.id).toBe(note.id)
    expect(settled.path).toBe('Notas rápidas/Plan de ventas.md')
    // Otra con el mismo título no pisa: «Plan de ventas 2».
    const other = await notes.create('# Plan de ventas')
    expect(other.path).toBe('Notas rápidas/Plan de ventas 2.md')
  })

  it('no pisa cambios hechos fuera de la app', async () => {
    const note = await notes.create('# Uno')
    await new Promise((r) => setTimeout(r, 20))
    writeFileSync(join(root, note.path!), '# Uno editado en otro editor')
    await expect(notes.update(note.id, '# Uno mío', note.updatedAt)).rejects.toThrow()
    expect((await notes.update(note.id, '# Uno mío')).body).toBe('# Uno mío')
  })
})
