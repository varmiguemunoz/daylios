import { existsSync } from 'fs'
import { cp, mkdir, readFile, readdir, rename, rm, stat } from 'fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'path'
import type { DataSource } from 'typeorm'
import { withoutChangeLog } from '../db/author'
import { CLIENTS_FOLDER, clientFolderFor, ensureClientFolder, isInside } from './documents'

export const BACKUP_FOLDER = '.respaldo-clientes'
const PROTECTED = new Set(['workspace', 'organizaciones', '_reuniones', BACKUP_FOLDER])

export interface FolderMigration {
  moved: string[]
  failed: { name: string; error: string }[]
  backup: string | null
}

interface Row {
  id: string
  name: string
  folder_path: string
}

const sameContent = async (a: string, b: string): Promise<boolean> => {
  const [sa, sb] = await Promise.all([stat(a), stat(b)])
  if (sa.size !== sb.size) return false
  const [ca, cb] = await Promise.all([readFile(a), readFile(b)])
  return ca.equals(cb)
}

const withSuffix = (path: string, suffix: string): string => {
  const ext = extname(path)
  return `${path.slice(0, path.length - ext.length)} (${suffix})${ext}`
}

async function moveDir(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    await cp(from, to, { recursive: true, errorOnExist: true })
    await rm(from, { recursive: true, force: true })
  }
}

async function mergeInto(from: string, to: string, moved: Map<string, string>): Promise<void> {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) {
      await mkdir(target, { recursive: true })
      await mergeInto(source, target, moved)
      continue
    }
    if (!entry.isFile()) continue
    if (existsSync(target) && (await sameContent(source, target))) {
      moved.set(source, target)
      continue
    }
    let destination = target
    for (let n = 1; existsSync(destination); n++)
      destination = withSuffix(target, n === 1 ? 'antiguo' : `antiguo ${n}`)
    await rename(source, destination)
    moved.set(source, destination)
  }
}

async function relocate(folder: string, target: string): Promise<Map<string, string>> {
  const moved = new Map<string, string>()
  if (!existsSync(target)) {
    await mkdir(dirname(target), { recursive: true })
    await moveDir(folder, target)
    return moved
  }
  await mergeInto(folder, target, moved)
  await rm(folder, { recursive: true, force: true })
  return moved
}

const remap = (path: string, folder: string, target: string, moved: Map<string, string>): string =>
  moved.get(path) ?? join(target, relative(folder, path))

export async function moveClientFolders(opts: {
  db: DataSource
  docsRoot: string
  workspaceRoot: string
  now?: Date
}): Promise<FolderMigration> {
  const clientsRoot = join(opts.workspaceRoot, CLIENTS_FOLDER)
  const rows: Row[] = await opts.db.query(
    'SELECT id, name, folder_path FROM clients WHERE deleted_at IS NULL'
  )
  const pending = rows.filter(
    (r) => !isInside(clientsRoot, r.folder_path) && isInside(opts.docsRoot, r.folder_path)
  )
  const result: FolderMigration = { moved: [], failed: [], backup: null }
  if (!pending.length) return result

  const stamp = (opts.now ?? new Date()).toISOString().replace(/[:.]/g, '-')
  const backupRoot = join(opts.docsRoot, BACKUP_FOLDER, stamp)

  for (const row of pending) {
    const folder = row.folder_path
    const target = clientFolderFor(opts.workspaceRoot, row.name)
    try {
      if (
        PROTECTED.has(basename(folder).toLowerCase()) ||
        isInside(folder, opts.workspaceRoot) ||
        folder === opts.docsRoot
      )
        throw new Error('La carpeta comparte nombre con una carpeta del sistema; muévela a mano.')
      let moved = new Map<string, string>()
      if (existsSync(folder)) {
        await cp(folder, join(backupRoot, basename(folder)), { recursive: true })
        result.backup = backupRoot
        moved = await relocate(folder, target)
      }
      await ensureClientFolder(target)
      const meetings: { id: string; recording_path: string }[] = await opts.db.query(
        'SELECT id, recording_path FROM meetings WHERE recording_path IS NOT NULL'
      )
      await withoutChangeLog(async () => {
        await opts.db.query('UPDATE clients SET folder_path = ? WHERE id = ?', [target, row.id])
        for (const m of meetings) {
          if (!m.recording_path.startsWith(folder + sep)) continue
          await opts.db.query('UPDATE meetings SET recording_path = ? WHERE id = ?', [
            remap(m.recording_path, folder, target, moved),
            m.id
          ])
        }
      })
      result.moved.push(row.name)
    } catch (error) {
      result.failed.push({ name: row.name, error: String((error as Error).message ?? error) })
    }
  }
  return result
}
