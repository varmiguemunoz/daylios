import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from 'typeorm'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { ClientService } from '../main/services/client.service'
import { clientFolderFor, isInside, safeFolderName } from '../main/services/documents'
import { BACKUP_FOLDER, moveClientFolders } from '../main/services/client-folders.migration'

describe('nombres de carpeta válidos en macOS y Windows', () => {
  it('limpia caracteres, puntos y espacios finales y nombres reservados', () => {
    expect(safeFolderName('Acme: S.A. ')).toBe('Acme- S.A')
    expect(safeFolderName('a/b\\c*?')).toBe('a-b-c--')
    expect(safeFolderName('CON')).toBe('CON_')
    expect(safeFolderName('nul.md')).toBe('nul_.md')
    expect(safeFolderName('Consultora')).toBe('Consultora')
  })

  it('la carpeta del cliente vive en Workspace/Clientes', () => {
    expect(clientFolderFor(join('w'), 'Acme')).toBe(join('w', 'Clientes', 'Acme'))
    expect(clientFolderFor(join('w'), '...')).toBe(join('w', 'Clientes', 'Cliente'))
  })

  it('isInside no confunde prefijos', () => {
    expect(isInside(join('a', 'b'), join('a', 'b', 'c'))).toBe(true)
    expect(isInside(join('a', 'b'), join('a', 'bc'))).toBe(false)
    expect(isInside(join('a', 'b'), join('a', 'b'))).toBe(false)
  })
})

describe('migración de carpetas de cliente', () => {
  let db: DataSource
  let docs: string
  let workspace: string

  const client = async (id: string, name: string, folder: string): Promise<void> => {
    await db.query(
      `INSERT INTO clients (id, name, status, contacts_md, notes_md, folder_path, created_at, updated_at)
       VALUES (?, ?, 'activo', '', '', ?, '2026-01-01', '2026-01-01')`,
      [id, name, folder]
    )
  }

  beforeEach(async () => {
    db = await memoryDb()
    docs = mkdtempSync(join(tmpdir(), 'daylios-clients-'))
    workspace = join(docs, 'Workspace')
    mkdirSync(workspace)
  })
  afterEach(() => db.destroy())

  it('mueve la carpeta, deja copia y actualiza grabaciones', async () => {
    const old = join(docs, 'Dave Nelson')
    mkdirSync(join(old, 'Reuniones'), { recursive: true })
    writeFileSync(join(old, 'Reuniones', 'r.webm'), 'audio')
    await client('c1', 'Dave Nelson', old)
    await db.query(
      `INSERT INTO meetings (id, title, date, client_id, participants, action_items, status, recording_path, created_at, updated_at)
       VALUES ('m1', 'Kickoff', '2026-01-02', 'c1', '[]', '[]', 'listo', ?, '2026-01-02', '2026-01-02')`,
      [join(old, 'Reuniones', 'r.webm')]
    )
    const result = await moveClientFolders({ db, docsRoot: docs, workspaceRoot: workspace })
    const target = join(workspace, 'Clientes', 'Dave Nelson')
    expect(result.moved).toEqual(['Dave Nelson'])
    expect(existsSync(old)).toBe(false)
    expect(readFileSync(join(target, 'Reuniones', 'r.webm'), 'utf8')).toBe('audio')
    expect(existsSync(join(target, 'Contratos'))).toBe(true)
    expect(existsSync(join(result.backup!, 'Dave Nelson', 'Reuniones', 'r.webm'))).toBe(true)
    expect(result.backup!.startsWith(join(docs, BACKUP_FOLDER))).toBe(true)
    const [row] = await db.query(`SELECT folder_path FROM clients WHERE id = 'c1'`)
    expect(row.folder_path).toBe(target)
    const [meeting] = await db.query(`SELECT recording_path FROM meetings WHERE id = 'm1'`)
    expect(meeting.recording_path).toBe(join(target, 'Reuniones', 'r.webm'))
  })

  it('fusiona sin pisar y se puede repetir sin efecto', async () => {
    const old = join(docs, 'Acme')
    const target = join(workspace, 'Clientes', 'Acme')
    mkdirSync(old, { recursive: true })
    mkdirSync(target, { recursive: true })
    writeFileSync(join(old, 'a.txt'), 'viejo')
    writeFileSync(join(target, 'a.txt'), 'nuevo')
    writeFileSync(join(old, 'igual.txt'), 'x')
    writeFileSync(join(target, 'igual.txt'), 'x')
    await client('c2', 'Acme', old)
    await moveClientFolders({ db, docsRoot: docs, workspaceRoot: workspace })
    expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('nuevo')
    expect(readFileSync(join(target, 'a (antiguo).txt'), 'utf8')).toBe('viejo')
    expect(existsSync(join(target, 'igual (antiguo).txt'))).toBe(false)
    expect(existsSync(old)).toBe(false)
    const again = await moveClientFolders({ db, docsRoot: docs, workspaceRoot: workspace })
    expect(again).toEqual({ moved: [], failed: [], backup: null })
  })

  it('no toca carpetas fuera de la raíz ni carpetas del sistema', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'daylios-outside-'))
    await client('c3', 'Fuera', outside)
    await client('c4', 'Workspace', workspace)
    const result = await moveClientFolders({ db, docsRoot: docs, workspaceRoot: workspace })
    expect(existsSync(outside)).toBe(true)
    expect(result.moved).toEqual([])
    expect(result.failed.map((f) => f.name)).toEqual(['Workspace'])
    expect(existsSync(join(workspace, 'Clientes', 'Workspace'))).toBe(false)
  })

  it('un cliente sin carpeta en disco solo cambia la ruta', async () => {
    await client('c5', 'Nueva', join(docs, 'Nueva'))
    const result = await moveClientFolders({ db, docsRoot: docs, workspaceRoot: workspace })
    expect(result.moved).toEqual(['Nueva'])
    expect(existsSync(join(workspace, 'Clientes', 'Nueva', 'Entregables'))).toBe(true)
  })
})

describe('cliente y su carpeta', () => {
  let db: DataSource
  let docs: string

  beforeEach(async () => {
    docs = join(isolatedConfig(), 'clientes')
    db = await memoryDb()
  })
  afterEach(() => db.destroy())

  it('crear lo pone en Workspace/Clientes y renombrar mueve la carpeta', async () => {
    const service = new ClientService(db)
    const acme = await service.create({ name: 'Acme' })
    expect(acme.folderPath).toBe(join(docs, 'Workspace', 'Clientes', 'Acme'))
    writeFileSync(join(acme.folderPath, 'Contratos', 'firmado.pdf'), 'pdf')
    const renamed = await service.update(acme.id, { name: 'Acme SA' })
    expect(renamed.folderPath).toBe(join(docs, 'Workspace', 'Clientes', 'Acme SA'))
    expect(existsSync(acme.folderPath)).toBe(false)
    expect(readFileSync(join(renamed.folderPath, 'Contratos', 'firmado.pdf'), 'utf8')).toBe('pdf')
  })

  it('no renombra encima de otra carpeta', async () => {
    const service = new ClientService(db)
    const a = await service.create({ name: 'Uno' })
    await service.create({ name: 'Dos' })
    await expect(service.update(a.id, { name: 'Dos' })).rejects.toThrow()
    expect(existsSync(a.folderPath)).toBe(true)
  })
})
