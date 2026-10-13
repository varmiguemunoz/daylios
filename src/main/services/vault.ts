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
import { dirname, join, sep } from 'path'
import { baseName, extOf, isIgnored, kindOf, normalizePath, type ItemKind } from '@shared/workspace'
import { AppError } from './app.error'
import { safeFolderName } from './documents'
import { moveToTrash } from './trash'

/** Lo que el disco dice de un elemento. */
export interface DiskEntry {
  path: string
  kind: ItemKind
  inode: string
  size: number
  mtimeMs: number
  birthtime: string
}

const MAX_DEPTH = 24
const MAX_NAME = 120

/** Nombre válido en macOS, sin punto inicial (oculto) ni barras. Lanza si queda vacío. */
export function safeName(name: unknown): string {
  const clean = safeFolderName(String(name ?? ''))
    .replace(/^\.+/, '')
    .slice(0, MAX_NAME)
    .trim()
  if (!clean) throw new AppError('invalid', 'Escribe un nombre.')
  return clean
}

/**
 * Puerto de disco de la bóveda. Todas las rutas que recibe son relativas a la raíz y se validan:
 * nada sale de la bóveda (ni con `..`, ni rutas absolutas, ni symlinks, que no se siguen).
 */
export class Vault {
  constructor(private readonly rootPath: () => string) {}

  root(): string {
    return this.rootPath()
  }

  async ensure(): Promise<void> {
    await mkdir(this.root(), { recursive: true })
  }

  /** Ruta absoluta de `rel`, validada. */
  abs(rel: string): string {
    const clean = normalizePath(String(rel ?? ''))
    if (clean === null) throw new AppError('invalid', 'Esa ruta está fuera del workspace.')
    return clean ? join(this.root(), ...clean.split('/')) : this.root()
  }

  /**
   * Como `abs`, y además comprueba con `realpath` que el ancestro existente más cercano sigue dentro
   * de la bóveda (un symlink a otra carpeta no cuela).
   */
  async safe(rel: string): Promise<string> {
    const full = this.abs(rel)
    const root = await realpath(this.root())
    let probe = full
    while (!existsSync(probe) && probe !== dirname(probe)) probe = dirname(probe)
    const real = await realpath(probe)
    if (real !== root && !real.startsWith(root + sep)) {
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

  /** Todo lo de la bóveda (sin ocultos ni symlinks), carpetas antes que su contenido. */
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
        const info = await lstat(join(dir, entry.name)).catch(() => null)
        if (!info) continue
        out.push({
          path: rel,
          kind: kindOf(entry.name, entry.isDirectory()),
          inode: String(info.ino),
          size: entry.isDirectory() ? 0 : info.size,
          mtimeMs: info.mtimeMs,
          birthtime: (info.birthtime.getTime() ? info.birthtime : info.mtime).toISOString()
        })
        if (entry.isDirectory()) await walk(rel, depth + 1)
      }
    }
    await walk('', 0)
    return out
  }

  async entry(rel: string): Promise<DiskEntry | null> {
    const full = await this.safe(rel)
    const info = await stat(full).catch(() => null)
    if (!info) return null
    return {
      path: rel,
      kind: kindOf(baseName(rel), info.isDirectory()),
      inode: String(info.ino),
      size: info.isDirectory() ? 0 : info.size,
      mtimeMs: info.mtimeMs,
      birthtime: (info.birthtime.getTime() ? info.birthtime : info.mtime).toISOString()
    }
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

  /** Fecha de modificación (p. ej. conservar la de una nota migrada). */
  async touch(rel: string, date: Date): Promise<void> {
    await utimes(await this.safe(rel), date, date)
  }

  async mkdir(rel: string): Promise<void> {
    await mkdir(await this.safe(rel), { recursive: true })
  }

  /** Renombra o mueve. Falla si el destino ya existe (no pisa nada). */
  async move(from: string, to: string): Promise<void> {
    const src = await this.safe(from)
    const dest = await this.safe(to)
    if (existsSync(dest) && src.toLowerCase() !== dest.toLowerCase()) {
      throw new AppError('invalid', `Ya existe «${baseName(to)}» ahí.`)
    }
    await mkdir(dirname(dest), { recursive: true })
    await rename(src, dest)
  }

  /** Copia un archivo de fuera (ruta absoluta elegida por el usuario) a `destRel`. */
  async copyIn(source: string, destRel: string): Promise<void> {
    const dest = await this.safe(destRel)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(source, dest)
  }

  async trash(rel: string): Promise<void> {
    if (!rel) throw new AppError('invalid', 'No se puede borrar la raíz del workspace.')
    await moveToTrash(await this.safe(rel))
  }

  /** «Nombre.ext» libre en la carpeta: si existe, «Nombre 2.ext», «Nombre 3.ext»… */
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
