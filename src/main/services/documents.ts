import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, stat } from 'fs/promises'
import { basename, extname, join, relative, resolve, sep } from 'path'
import type { DocFile } from '@shared/consultora'
import { AppError } from './app.error'

/**
 * Carpetas de documentos de los clientes. La carpeta es la fuente de verdad:
 * no se guarda nada de los archivos en la base, se lee en cada consulta.
 */

/** Subcarpetas que se crean al dar de alta un cliente. */
export const CLIENT_SUBFOLDERS = ['Contratos', 'Entregables', 'Documentación técnica', 'Reuniones']

/** Archivos cuyo contenido Claude puede leer. */
const TEXT_EXTENSIONS = ['.md', '.txt', '.csv', '.json']
const MAX_READ = 200_000
const MAX_DEPTH = 3

/** Nombre válido como carpeta en macOS ("Acme / Labs" → "Acme - Labs"). */
export function safeFolderName(name: string): string {
  return name
    .replace(/[/:\\*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Crea la carpeta del cliente y sus subcarpetas. Si ya existen, no toca nada. */
export async function ensureClientFolder(folder: string): Promise<void> {
  for (const sub of CLIENT_SUBFOLDERS) await mkdir(join(folder, sub), { recursive: true })
}

/** Todos los archivos de la carpeta (hasta 3 niveles), del más reciente al más antiguo. */
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

/** Contenido de un archivo de texto dentro de la carpeta del cliente (nunca fuera de ella). */
export async function readDocument(folder: string, path: string): Promise<string> {
  const full = resolve(folder, path)
  if (!full.startsWith(resolve(folder) + sep)) {
    throw new AppError('invalid', 'La ruta debe estar dentro de la carpeta del cliente.')
  }
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

/** Mueve un archivo a `<carpeta>/<subcarpeta>/`. Devuelve la ruta nueva (o la misma si ya estaba ahí). */
export async function moveInto(file: string, folder: string, sub: string): Promise<string> {
  const target = join(folder, sub)
  if (file.startsWith(target + sep) || !existsSync(file)) return file
  await mkdir(target, { recursive: true })
  const destination = join(target, basename(file))
  await rename(file, destination)
  return destination
}
