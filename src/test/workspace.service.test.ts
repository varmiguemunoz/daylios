import { existsSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import type { WorkspaceService } from '../main/services/workspace.service'
import { tempWorkspace } from '../main/test/workspace'

describe('WorkspaceService', () => {
  let db: DataSource
  let root: string
  let ws: WorkspaceService

  beforeEach(async () => {
    ;({ db, root, workspace: ws } = await tempWorkspace())
  })
  afterEach(() => db.destroy())

  it('carpetas: crear, subcarpeta, renombrar y mover se reflejan en disco', async () => {
    const ventas = await ws.createFolder(null, 'Ventas')
    const sub = await ws.createFolder(ventas.id, '2026')
    expect(existsSync(join(root, 'Ventas', '2026'))).toBe(true)
    const renamed = await ws.rename(ventas.id, 'Comercial')
    expect(renamed.id).toBe(ventas.id)
    expect(existsSync(join(root, 'Comercial', '2026'))).toBe(true)
    const archivo = await ws.createFolder(null, 'Archivo')
    const moved = await ws.move(sub.id, archivo.id)
    expect(moved.id).toBe(sub.id)
    expect(moved.path).toBe('Archivo/2026')
    const listing = await ws.list(archivo.id)
    expect(listing.items.map((i) => i.name)).toEqual(['2026'])
    expect(listing.crumbs.map((c) => c.name)).toEqual(['Workspace', 'Archivo'])
  })

  it('lee los bytes de un archivo de la bóveda y nunca fuera de ella', async () => {
    writeFileSync(join(root, 'doc.pdf'), Buffer.from('%PDF-1.4'))
    const file = await ws.fileBytes('doc.pdf')
    expect(file.size).toBe(8)
    expect(Buffer.from(file.data!).toString()).toBe('%PDF-1.4')
    await expect(ws.fileBytes('../fuera.pdf')).rejects.toThrow()
  })

  it('no se mueve una carpeta dentro de sí misma ni se repiten nombres', async () => {
    const a = await ws.createFolder(null, 'A')
    const b = await ws.createFolder(a.id, 'B')
    await expect(ws.move(a.id, b.id)).rejects.toThrow()
    await expect(ws.createFolder(null, 'A')).rejects.toThrow()
  })

  it('un renombre hecho en Finder conserva el id', async () => {
    const note = await ws.createNote(null, 'Plan')
    renameSync(join(root, 'Plan.md'), join(root, 'Plan v2.md'))
    await ws.sync()
    const item = await ws.get(note.id)
    expect(item.path).toBe('Plan v2.md')
    expect(item.name).toBe('Plan v2')
  })

  it('archivos creados fuera aparecen y los borrados desaparecen', async () => {
    writeFileSync(join(root, 'externa.md'), '# Externa\n\nhola mundo')
    await ws.sync()
    const hits = await ws.search('mundo')
    expect(hits.map((h) => h.item.name)).toEqual(['externa'])
    const id = hits[0].item.id
    await ws.remove(id)
    await expect(ws.get(id)).rejects.toThrow()
    expect(existsSync(join(root, 'externa.md'))).toBe(false)
  })

  it('mover una imagen reescribe la nota que la usa; el impacto la cuenta', async () => {
    mkdirSync(join(root, 'Adjuntos'))
    writeFileSync(join(root, 'Adjuntos', 'logo.png'), 'png')
    const folder = await ws.createFolder(null, 'Ventas')
    await ws.createNote(folder.id, 'Marca', '# Marca\n\n![logo](../Adjuntos/logo.png)')
    await ws.sync()
    const logo = (await ws.search('logo')).find((h) => h.item.kind === 'image')!.item
    expect((await ws.impact(logo.id)).referencedBy).toBe(1)
    const marca = await ws.createFolder(null, 'Marca visual')
    await ws.move(logo.id, marca.id)
    expect(readFileSync(join(root, 'Ventas', 'Marca.md'), 'utf8')).toContain(
      '![logo](../Marca%20visual/logo.png)'
    )
  })

  it('subir copia a la carpeta con nombre libre; nada fuera de la bóveda', async () => {
    const outside = join(tmpdir(), `daylios-up-${Date.now()}.txt`)
    writeFileSync(outside, 'hola')
    const [a] = await ws.upload(null, [outside])
    const [b] = await ws.upload(null, [outside])
    expect(a.name).not.toBe(b.name)
    await expect(ws.resolve('../../etc/passwd')).rejects.toThrow()
    symlinkSync(tmpdir(), join(root, 'fuera'))
    await expect(ws.absOf('fuera/x.txt')).rejects.toThrow()
  })

  it('boards: escribir valida JSON Canvas y detecta cambios hechos fuera', async () => {
    const board = await ws.createBoard(null, 'Embudo')
    const first = await ws.readBoard(board.id)
    await expect(ws.writeBoard(board.id, '{roto')).rejects.toThrow()
    const json = JSON.stringify({
      nodes: [{ id: 'a', type: 'text', text: 'Lead', x: 0, y: 0, width: 200, height: 80 }],
      edges: []
    })
    const saved = await ws.writeBoard(board.id, json, first.modifiedAt)
    await new Promise((r) => setTimeout(r, 20))
    writeFileSync(join(root, 'Embudo.canvas'), json)
    await expect(ws.writeBoard(board.id, json, saved.modifiedAt)).rejects.toThrow()
  })
})

describe('WorkspaceService · notas y explorador', () => {
  let db: DataSource
  let root: string
  let ws: WorkspaceService

  beforeEach(async () => {
    ;({ db, root, workspace: ws } = await tempWorkspace())
  })
  afterEach(() => db.destroy())

  it('renombrar una nota cambia también su título', async () => {
    const note = await ws.createNote(null, 'Borrador', '# Borrador\n\nTexto')
    await ws.rename(note.id, 'Plan final')
    expect(readFileSync(join(root, 'Plan final.md'), 'utf8')).toBe('# Plan final\n\nTexto')
  })

  it('el explorador trae carpetas con sus archivos y los de la raíz', async () => {
    const ventas = await ws.createFolder(null, 'Ventas')
    await ws.createNote(ventas.id, 'Embudo')
    await ws.createBoard(null, 'Mapa')
    const tree = await ws.explorer()
    expect(tree.folders.map((f) => f.name)).toEqual(['Ventas'])
    expect(tree.folders[0].items?.map((i) => i.name)).toEqual(['Embudo'])
    expect(tree.files.map((i) => i.name)).toEqual(['Mapa'])
    expect((await ws.tree())[0].items).toBeUndefined()
  })
})
