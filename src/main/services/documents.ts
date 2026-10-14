import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import type { DocFile } from '@shared/consultora'
import { AppError } from './app.error'
import { moveToTrash } from './trash'

export const CLIENT_SUBFOLDERS = ['Contratos', 'Entregables', 'Documentación técnica', 'Reuniones']

const TEXT_EXTENSIONS = ['.md', '.txt', '.csv', '.json']
const MAX_READ = 200_000
const MAX_DEPTH = 3

export function safeFolderName(name: string): string {
  return name
    .replace(/[/:\\*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function ensureClientFolder(folder: string): Promise<void> {
  for (const sub of CLIENT_SUBFOLDERS) await mkdir(join(folder, sub), { recursive: true })
}

export async function listDocuments(folder: string): Promise<DocFile[]> {
  if (!existsSync(folder)) return []
  const files: DocFile[] = []

  const walk = async (dir: string, depth: number): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) await walk(full, depth + 1)
      } else if (entry.isFile()) {
        const info = await stat(full)
        const path = relative(folder, full)
        files.push({
          path,
          name: entry.name,
          folder: relative(folder, dir) || '.',
          size: info.size,
          modifiedAt: info.mtime.toISOString()
        })
      }
    }
  }

  await walk(folder, 1)
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
}

export function safePath(folder: string, path: string): string {
  const full = resolve(folder, path)
  if (!full.startsWith(resolve(folder) + sep)) {
    throw new AppError('invalid', 'La ruta debe estar dentro de la carpeta del cliente.')
  }
  return full
}

export const isTextDocument = (path: string): boolean =>
  TEXT_EXTENSIONS.includes(extname(path).toLowerCase())

export async function readDocument(folder: string, path: string): Promise<string> {
  const full = safePath(folder, path)
  if (!TEXT_EXTENSIONS.includes(extname(full).toLowerCase())) {
    throw new AppError(
      'invalid',
      `Solo puedo leer ${TEXT_EXTENSIONS.join(', ')}. Este archivo solo se lista.`
    )
  }
  if (!existsSync(full)) throw new AppError('not_found', 'No existe ese archivo.')
  const content = await readFile(full, 'utf8')
  return content.length > MAX_READ ? `${content.slice(0, MAX_READ)}\n\n…(recortado)` : content
}

export async function moveInto(file: string, folder: string, sub: string): Promise<string> {
  const target = join(folder, sub)
  if (file.startsWith(target + sep) || !existsSync(file)) return file
  await mkdir(target, { recursive: true })
  const destination = join(target, basename(file))
  await rename(file, destination)
  return destination
}

export async function renameDocument(folder: string, path: string, name: string): Promise<string> {
  const from = safePath(folder, path)
  const clean = safeFolderName(String(name ?? ''))
  if (!clean || clean.startsWith('.'))
    throw new AppError('invalid', 'Escribe un nombre de archivo válido.')
  if (!existsSync(from)) throw new AppError('not_found', 'No existe ese archivo.')
  const to = join(dirname(from), clean)
  safePath(folder, relative(folder, to))
  if (to === from) return relative(folder, from)
  if (existsSync(to)) throw new AppError('invalid', `Ya existe «${clean}» en esa carpeta.`)
  await rename(from, to)
  return relative(folder, to)
}

export async function trashDocument(folder: string, path: string): Promise<void> {
  const full = safePath(folder, path)
  if (!existsSync(full)) throw new AppError('not_found', 'No existe ese archivo.')
  await moveToTrash(full)
}

const MAX_WRITE = 1_000_000

export async function writeDocument(
  folder: string,
  path: string,
  content: string,
  expectedModifiedAt?: string
): Promise<{ path: string; modifiedAt: string }> {
  const full = safePath(folder, path)
  if (!isTextDocument(full)) {
    throw new AppError('invalid', `Solo se editan ${TEXT_EXTENSIONS.join(', ')}.`)
  }
  if (typeof content !== 'string' || content.length > MAX_WRITE) {
    throw new AppError('invalid', 'El documento debe ser texto de menos de 1 MB.')
  }
  if (expectedModifiedAt && existsSync(full)) {
    const current = (await stat(full)).mtime.toISOString()
    if (current !== expectedModifiedAt) {
      throw new AppError(
        'invalid',
        'El archivo cambió fuera de la app. Vuelve a abrirlo antes de guardar.'
      )
    }
  }
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content, 'utf8')
  return { path: relative(folder, full), modifiedAt: (await stat(full)).mtime.toISOString() }
}

export async function openDocument(
  folder: string,
  path: string
): Promise<{ path: string; name: string; content: string; modifiedAt: string }> {
  const full = safePath(folder, path)
  if (!isTextDocument(full))
    throw new AppError('invalid', `Solo se editan ${TEXT_EXTENSIONS.join(', ')}.`)
  if (!existsSync(full)) throw new AppError('not_found', 'No existe ese archivo.')
  const info = await stat(full)
  if (info.size > MAX_WRITE)
    throw new AppError('invalid', 'Es demasiado grande para editarlo aquí. Ábrelo con su app.')
  return {
    path: relative(folder, full),
    name: basename(full),
    content: await readFile(full, 'utf8'),
    modifiedAt: info.mtime.toISOString()
  }
}
