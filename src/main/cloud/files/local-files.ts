import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join, relative, sep } from 'path'
import { isIgnoredPath } from '@shared/files'

export interface LocalFile {
  path: string
  size: number
  mtimeMs: number
}

export const toRelative = (root: string, full: string): string =>
  relative(root, full).split(sep).join('/')
export const toFull = (root: string, path: string): string => join(root, ...path.split('/'))

export async function scan(root: string, recordings: boolean): Promise<Map<string, LocalFile>> {
  const out = new Map<string, LocalFile>()
  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const path = toRelative(root, full)
      if (isIgnoredPath(path, recordings)) continue
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) {
        const s = await stat(full).catch(() => null)
        if (s) out.set(path, { path, size: s.size, mtimeMs: Math.floor(s.mtimeMs) })
      }
    }
  }
  await walk(root)
  return out
}

export function hashFile(full: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(full)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}
