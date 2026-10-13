/**
 * Workspace: una bóveda en disco (carpeta real) con notas `.md`, boards `.canvas`, imágenes y archivos.
 * La carpeta es la fuente de verdad; SQLite guarda un índice con ids estables.
 * Rutas siempre relativas a la bóveda, con `/`. La raíz es ''.
 */

export type ItemKind = 'folder' | 'note' | 'board' | 'image' | 'file'

export interface WorkspaceItem {
  id: string
  kind: ItemKind
  /** Relativa a la bóveda, con `/` («Ventas/Embudo.canvas»). */
  path: string
  /** Para mostrar: sin extensión en notas y boards. */
  name: string
  /** Carpeta que lo contiene; null = raíz. */
  parentId: string | null
  size: number
  createdAt: string
  updatedAt: string
}

export interface Crumb {
  id: string | null
  name: string
}

export interface FolderListing {
  /** null = raíz de la bóveda. */
  folder: WorkspaceItem | null
  crumbs: Crumb[]
  items: WorkspaceItem[]
}

export interface FolderNode {
  id: string
  name: string
  path: string
  children: FolderNode[]
  /** Elementos que no son carpeta, directos. */
  files: number
  /** Esos elementos (solo en el árbol del explorador). */
  items?: WorkspaceItem[]
}

/** Árbol del explorador: carpetas con sus archivos y los archivos sueltos de la raíz. */
export interface ExplorerTree {
  folders: FolderNode[]
  files: WorkspaceItem[]
}

/** Lo que se pierde al borrar (para confirmar). */
export interface DeleteImpact {
  folders: number
  notes: number
  boards: number
  files: number
  /** Notas o boards que enlazan a lo que se borra (quedarán con el enlace roto). */
  referencedBy: number
}

export interface SearchHit {
  item: WorkspaceItem
  /** Fragmento del texto alrededor de la coincidencia (notas). */
  snippet: string
}

/** Contenido de un board: el JSON Canvas tal cual y su versión en disco. */
export interface BoardContent {
  item: WorkspaceItem
  json: string
  modifiedAt: string
}

export interface WorkspaceInfo {
  root: string
  /** id de la carpeta «Notas rápidas». */
  quickNotesId: string
}

/** Contrato de la UI (IPC) que implementa WorkspaceService. */
export interface WorkspaceApi {
  info(): Promise<WorkspaceInfo>
  tree(): Promise<FolderNode[]>
  /** Carpetas y archivos, para el explorador. */
  explorer(): Promise<ExplorerTree>
  list(folderId: string | null): Promise<FolderListing>
  get(id: string): Promise<WorkspaceItem>
  /** Por id o por ruta de la bóveda (los boards guardan rutas). */
  resolve(ref: string): Promise<WorkspaceItem>
  search(query: string): Promise<SearchHit[]>
  createFolder(parentId: string | null, name: string): Promise<WorkspaceItem>
  /** Nota con ese nombre (o «Sin título») y, si se pasa, su texto inicial. */
  createNote(folderId: string | null, name?: string, body?: string): Promise<WorkspaceItem>
  createBoard(folderId: string | null, name?: string): Promise<WorkspaceItem>
  rename(id: string, name: string): Promise<WorkspaceItem>
  move(id: string, folderId: string | null): Promise<WorkspaceItem>
  impact(id: string): Promise<DeleteImpact>
  /** A la Papelera de macOS. */
  remove(id: string): Promise<void>
  /** Copia archivos del disco (rutas absolutas) a la carpeta. */
  upload(folderId: string | null, paths: string[]): Promise<WorkspaceItem[]>
  /** Diálogo del sistema para elegir archivos; devuelve rutas o []. */
  pickFiles(): Promise<string[]>
  /** Guarda una imagen pegada en `Adjuntos/` y devuelve la ruta relativa a la nota. */
  attach(
    noteId: string,
    name: string,
    data: Uint8Array
  ): Promise<{ item: WorkspaceItem; link: string }>
  readBoard(id: string): Promise<BoardContent>
  /** `expected` = `modifiedAt` leído; si el archivo cambió fuera, error `conflict`. Sin él, sobrescribe. */
  writeBoard(id: string, json: string, expected?: string): Promise<BoardContent>
  /** Muestra el elemento en Finder. */
  reveal(id: string): Promise<void>
  /** Abre un archivo con su app de macOS. */
  openExternal(id: string): Promise<void>
}

// ---- constantes y ayudantes puros (main y renderer) ----

/** Mensaje del error de conflicto: la UI lo reconoce para ofrecer «Recargar» o «Guardar mi versión». */
export const CONFLICT_MESSAGE = 'El archivo cambió fuera de la app.'

export const QUICK_NOTES = 'Notas rápidas'
export const ATTACHMENTS = 'Adjuntos'
export const MAX_UPLOAD = 50 * 1024 * 1024

export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

/** Ocultos y de sistema: no forman parte de la bóveda. */
export const isIgnored = (name: string): boolean =>
  name.startsWith('.') || name === 'node_modules' || name === 'Thumbs.db'

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i).toLowerCase() : ''
}

export function kindOf(name: string, isDir: boolean): ItemKind {
  if (isDir) return 'folder'
  const ext = extOf(name)
  if (ext === '.md') return 'note'
  if (ext === '.canvas') return 'board'
  if (IMAGE_EXT.includes(ext)) return 'image'
  return 'file'
}

/** Nombre a mostrar: sin `.md` ni `.canvas`. */
export function displayName(fileName: string, kind: ItemKind): string {
  if (kind === 'note' || kind === 'board')
    return fileName.slice(0, fileName.length - extOf(fileName).length)
  return fileName
}

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
export const dirName = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
/** Une tramos de ruta. Lanza si el resultado saldría de la bóveda. */
export function joinPath(...parts: string[]): string {
  const path = normalizePath(parts.filter(Boolean).join('/'))
  if (path === null) throw new Error('Ruta fuera de la bóveda.')
  return path
}

/** Resuelve `.` y `..` sin salir de la raíz. null si escaparía o si es absoluta. */
export function normalizePath(path: string): string | null {
  const clean = path.replace(/\\/g, '/')
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) return null
  const out: string[] = []
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!out.length) return null
      out.pop()
    } else out.push(part)
  }
  return out.join('/')
}

/** Ruta de `to` vista desde la carpeta `fromDir` («../Adjuntos/a.png»). */
export function relativePath(fromDir: string, to: string): string {
  const a = fromDir ? fromDir.split('/') : []
  const b = to.split('/')
  let i = 0
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

/** URL para pintar un archivo de la bóveda en la app (protocolo `vault://`, validado en main). */
export const vaultUrl = (path: string): string =>
  `vault://path/${path.split('/').map(encodeURIComponent).join('/')}`
