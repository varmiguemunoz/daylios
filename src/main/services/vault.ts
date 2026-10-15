import { existsSync } from 'fs'
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  utimes,
  writeFile
} from 'fs/promises'
import { dirname, join } from 'path'
import { baseName, extOf, isIgnored, kindOf, normalizePath, type ItemKind } from '@shared/workspace'
import { AppError } from './app.error'
import { isInside, safeFolderName } from './documents'
import { moveToTrash } from './trash'

export interface DiskEntry {
  path: string
  kind: ItemKind
  inode: string
  size: number
  mtimeMs: number
  birthtime: string
}

interface FileInfo {
  inode: string
  size: number
  mtimeMs: number
  birthtime: Date
  isDirectory: boolean
}

export async function fileInfo(
  full: string,
  follow: boolean,
  wide = process.platform === 'win32'
): Promise<FileInfo | null> {
  const read = follow ? stat : lstat
  if (!wide) {
    const info = await read(full).catch(() => null)
    if (!info) return null
    const { ino, size, mtimeMs, birthtime } = info
    return { inode: String(ino), size, mtimeMs, birthtime, isDirectory: info.isDirectory() }
  }
  const info = await read(full, { bigint: true }).catch(() => null)
  if (!info) return null
  return {
    inode: info.ino.toString(),
    size: Number(info.size),
    mtimeMs: Number(info.mtimeNs / 1000n) / 1000,
    birthtime: info.birthtime,
    isDirectory: info.isDirectory()
  }
}

const created = (info: FileInfo): string =>
  (info.birthtime.getTime() ? info.birthtime : new Date(info.mtimeMs)).toISOString()

const MAX_DEPTH = 24
const MAX_NAME = 120

export function safeName(name: unknown): string {
  const clean = safeFolderName(String(name ?? ''))
    .replace(/^\.+/, '')
    .slice(0, MAX_NAME)
    .trim()
  if (!clean) throw new AppError('invalid', 'Escribe un nombre.')
  return clean
}

export class Vault {
  constructor(private readonly rootPath: () => string) {}

  root(): string {
    return this.rootPath()
  }

  async ensure(): Promise<void> {
    await mkdir(this.root(), { recursive: true })
  }

  abs(rel: string): string {
    const clean = normalizePath(String(rel ?? ''))
    if (clean === null) throw new AppError('invalid', 'Esa ruta está fuera del workspace.')
    return clean ? join(this.root(), ...clean.split('/')) : this.root()
  }

  async safe(rel: string): Promise<string> {
    const full = this.abs(rel)
    const root = await realpath(this.root())
    let probe = full
    while (!existsSync(probe) && probe !== dirname(probe)) probe = dirname(probe)
    const real = await realpath(probe)
    if (real !== root && !isInside(root, real)) {
      throw new AppError('invalid', 'Esa ruta está fuera del workspace.')
    }
    if (existsSync(full) && (await lstat(full)).isSymbolicLink()) {
      throw new AppError('invalid', 'Los enlaces simbólicos no se abren desde el workspace.')
    }
    return full
  }

  exists(rel: string): boolean {
    return existsSync(this.abs(rel))
  }

  async scan(): Promise<DiskEntry[]> {
    await this.ensure()
    const out: DiskEntry[] = []
    const walk = async (relDir: string, depth: number): Promise<void> => {
      if (depth > MAX_DEPTH) return
      const dir = this.abs(relDir)
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (isIgnored(entry.name) || entry.isSymbolicLink()) continue
        if (!entry.isDirectory() && !entry.isFile()) continue
        const rel = relDir ? `${relDir}/${entry.name}` : entry.name
        const info = await fileInfo(join(dir, entry.name), false)
        if (!info) continue
        out.push({
          path: rel,
          kind: kindOf(entry.name, entry.isDirectory()),
          inode: info.inode,
          size: entry.isDirectory() ? 0 : info.size,
          mtimeMs: info.mtimeMs,
          birthtime: created(info)
        })
        if (entry.isDirectory()) await walk(rel, depth + 1)
      }
    }
    await walk('', 0)
    return out
  }

  async entry(rel: string): Promise<DiskEntry | null> {
    const full = await this.safe(rel)
    const info = await fileInfo(full, true)
    if (!info) return null
    return {
      path: rel,
      kind: kindOf(baseName(rel), info.isDirectory),
      inode: info.inode,
      size: info.isDirectory ? 0 : info.size,
      mtimeMs: info.mtimeMs,
      birthtime: created(info)
    }
  }

  async readBytes(rel: string, max: number): Promise<{ size: number; data: Uint8Array | null }> {
    const full = await this.safe(rel)
    const { size } = await stat(full)
    return { size, data: size > max ? null : new Uint8Array(await readFile(full)) }
  }

  async readText(rel: string): Promise<string> {
    return readFile(await this.safe(rel), 'utf8')
  }

  async writeText(rel: string, text: string): Promise<void> {
    const full = await this.safe(rel)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, text, 'utf8')
  }

  async writeBytes(rel: string, data: Uint8Array): Promise<void> {
    const full = await this.safe(rel)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, data)
  }

  async touch(rel: string, date: Date): Promise<void> {
    await utimes(await this.safe(rel), date, date)
  }

  async mkdir(rel: string): Promise<void> {
    await mkdir(await this.safe(rel), { recursive: true })
  }

  async move(from: string, to: string): Promise<void> {
    const src = await this.safe(from)
    const dest = await this.safe(to)
    if (existsSync(dest) && src.toLowerCase() !== dest.toLowerCase()) {
      throw new AppError('invalid', `Ya existe «${baseName(to)}» ahí.`)
    }
    await mkdir(dirname(dest), { recursive: true })
    await rename(src, dest)
  }

  async copyIn(source: string, destRel: string): Promise<void> {
    const dest = await this.safe(destRel)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(source, dest)
  }

  async trash(rel: string): Promise<void> {
    if (!rel) throw new AppError('invalid', 'No se puede borrar la raíz del workspace.')
    await moveToTrash(await this.safe(rel))
  }

  uniqueName(dirRel: string, fileName: string): string {
    const ext = extOf(fileName)
    const stem = ext ? fileName.slice(0, -ext.length) : fileName
    let candidate = fileName
    for (let i = 2; this.exists(dirRel ? `${dirRel}/${candidate}` : candidate); i++) {
      candidate = `${stem} ${i}${ext}`
    }
    return candidate
  }
}
