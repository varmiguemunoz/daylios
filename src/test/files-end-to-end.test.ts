import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataSource } from 'typeorm'
import { isolatedConfig, memoryDb } from '../main/test/helpers'
import { SyncEngine } from '../main/cloud/sync/engine'
import { FileSyncEngine } from '../main/cloud/files/engine'
import { SyncMutations } from '../../services/cloud/src/application/sync'
import { ManageFiles } from '../../services/cloud/src/application/files'
import type { AuthUser } from '../../services/cloud/src/ports'
import {
  MemoryBlobs,
  MemoryObjectStorage,
  MemoryStore,
  ORG,
  fakeApi,
  member
} from './support/memory-cloud'

interface Copy {
  db: DataSource
  root: string
  sync: SyncEngine
  files: FileSyncEngine
  trashed: string[]
}

describe('archivos de punta a punta con dos copias', () => {
  let storage: MemoryObjectStorage
  let a: Copy
  let b: Copy

  const make = async (
    user: AuthUser,
    device: string,
    server: SyncMutations,
    files: ManageFiles
  ): Promise<Copy> => {
    const db = await memoryDb()
    const root = mkdtempSync(join(tmpdir(), `daylios-files-${device}-`))
    const api = fakeApi(server, user, files)
    const trashed: string[] = []
    const copy: Copy = {
      db,
      root,
      trashed,
      sync: new SyncEngine({
        db,
        api: () => api,
        orgId: ORG,
        deviceId: `device-${device}`,
        markerFile: '/nonexistent/sync-init.json',
        notify: () => undefined,
        subscribe: () => () => undefined,
        fill: async () => ({}),
        onStatus: () => undefined
      }),
      files: new FileSyncEngine({
        db,
        api: () => api,
        orgId: ORG,
        root,
        recordings: () => false,
        userName: () => (device === 'a' ? 'Ana' : 'Beto'),
        trash: async (full) => {
          trashed.push(full)
          rmSync(full, { force: true })
        },
        onManifestChange: () => undefined,
        onStatus: () => undefined
      })
    }
    return copy
  }

  const round = async (): Promise<void> => {
    for (const c of [a, b]) {
      await c.files.syncNow()
      await c.sync.syncNow()
    }
    for (const c of [a, b]) {
      await c.sync.syncNow()
      await c.files.syncNow()
      await c.sync.syncNow()
    }
  }

  beforeEach(async () => {
    isolatedConfig()
    storage = new MemoryObjectStorage()
    vi.stubGlobal('fetch', storage.fetch)
    const server = new SyncMutations(
      new MemoryStore(),
      member,
      { changes: async () => undefined },
      { now: () => Date.now() }
    )
    const files = new ManageFiles(storage, new MemoryBlobs(), member, 200 * 1024 * 1024)
    a = await make({ userId: 'ua', email: 'a@acme.com' }, 'a', server, files)
    b = await make({ userId: 'ub', email: 'b@acme.com' }, 'b', server, files)
    await a.db.query(`INSERT INTO sync_state (key, value) VALUES ('bootstrapped', '1')`)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    for (const c of [a, b]) {
      await c.files.stop()
      await c.sync.stop()
      await c.db.destroy()
      rmSync(c.root, { recursive: true, force: true })
    }
  })

  it('un archivo nuevo en A aparece en B con el mismo contenido', async () => {
    mkdirSync(join(a.root, 'Workspace'), { recursive: true })
    writeFileSync(join(a.root, 'Workspace', 'Nota.md'), '# Hola')
    await round()
    expect(readFileSync(join(b.root, 'Workspace', 'Nota.md'), 'utf8')).toBe('# Hola')
  })

  it('renombrar una carpeta no vuelve a subir nada', async () => {
    mkdirSync(join(a.root, 'Clientes', 'Acme'), { recursive: true })
    for (let i = 0; i < 5; i++)
      writeFileSync(join(a.root, 'Clientes', 'Acme', `doc${i}.txt`), `contenido ${i}`)
    await round()
    const uploads = storage.puts
    renameSync(join(a.root, 'Clientes', 'Acme'), join(a.root, 'Clientes', 'Acme SAS'))
    await round()
    expect(storage.puts).toBe(uploads)
    expect(readdirSync(join(b.root, 'Clientes', 'Acme SAS')).sort()).toEqual([
      'doc0.txt',
      'doc1.txt',
      'doc2.txt',
      'doc3.txt',
      'doc4.txt'
    ])
    expect(existsSync(join(b.root, 'Clientes', 'Acme'))).toBe(false)
  })

  it('editar el mismo archivo en los dos deja una copia de conflicto', async () => {
    writeFileSync(join(a.root, 'Plan.md'), 'base')
    await round()
    writeFileSync(join(a.root, 'Plan.md'), 'versión de A')
    await a.files.syncNow()
    await a.sync.syncNow()
    writeFileSync(join(b.root, 'Plan.md'), 'versión de B')
    await b.sync.syncNow()
    await b.files.syncNow()
    expect(readFileSync(join(b.root, 'Plan.md'), 'utf8')).toBe('versión de A')
    const copy = readdirSync(b.root).find((f) => f.startsWith('Plan (conflicto de Beto'))
    expect(copy).toBeTruthy()
    expect(readFileSync(join(b.root, copy as string), 'utf8')).toBe('versión de B')
  })

  it('borrar en A manda el archivo de B a la papelera', async () => {
    writeFileSync(join(a.root, 'viejo.txt'), 'x')
    await round()
    rmSync(join(a.root, 'viejo.txt'))
    await round()
    expect(b.trashed.some((p) => p.endsWith('viejo.txt'))).toBe(true)
    const rows: { deleted_at: string | null }[] = await b.db.query(
      `SELECT deleted_at FROM file_manifest`
    )
    expect(rows[0].deleted_at).toBeTruthy()
  })

  it('un archivo de 20 MB se sube por partes y llega igual', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024, 7)
    writeFileSync(join(a.root, 'grande.bin'), big)
    await round()
    expect(readFileSync(join(b.root, 'grande.bin')).equals(big)).toBe(true)
  })
})
