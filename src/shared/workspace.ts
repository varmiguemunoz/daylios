export type ItemKind = 'folder' | 'note' | 'board' | 'image' | 'file'

export interface WorkspaceItem {
  id: string
  kind: ItemKind

  path: string

  name: string

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
  folder: WorkspaceItem | null
  crumbs: Crumb[]
  items: WorkspaceItem[]
}

export interface FolderNode {
  id: string
  name: string
  path: string
  children: FolderNode[]

  files: number

  items?: WorkspaceItem[]
}

export interface ExplorerTree {
  folders: FolderNode[]
  files: WorkspaceItem[]
}

export interface DeleteImpact {
  folders: number
  notes: number
  boards: number
  files: number

  referencedBy: number
}

export interface SearchHit {
  item: WorkspaceItem

  snippet: string
}

export interface BoardContent {
  item: WorkspaceItem
  json: string
  modifiedAt: string
}

export interface WorkspaceInfo {
  root: string

  quickNotesId: string
}

export interface WorkspaceApi {
  info(): Promise<WorkspaceInfo>
  tree(): Promise<FolderNode[]>

  explorer(): Promise<ExplorerTree>
  list(folderId: string | null): Promise<FolderListing>
  get(id: string): Promise<WorkspaceItem>

  resolve(ref: string): Promise<WorkspaceItem>
  search(query: string): Promise<SearchHit[]>
  createFolder(parentId: string | null, name: string): Promise<WorkspaceItem>

  createNote(folderId: string | null, name?: string, body?: string): Promise<WorkspaceItem>
  createBoard(folderId: string | null, name?: string): Promise<WorkspaceItem>
  rename(id: string, name: string): Promise<WorkspaceItem>
  move(id: string, folderId: string | null): Promise<WorkspaceItem>
  impact(id: string): Promise<DeleteImpact>

  remove(id: string): Promise<void>

  upload(folderId: string | null, paths: string[]): Promise<WorkspaceItem[]>

  pickFiles(): Promise<string[]>

  attach(
    noteId: string,
    name: string,
    data: Uint8Array
  ): Promise<{ item: WorkspaceItem; link: string }>
  readBoard(id: string): Promise<BoardContent>

  writeBoard(id: string, json: string, expected?: string): Promise<BoardContent>

  reveal(id: string): Promise<void>

  openExternal(id: string): Promise<void>
}

// ---- constantes y ayudantes puros (main y renderer) ----

export const CONFLICT_MESSAGE = 'El archivo cambió fuera de la app.'

export const QUICK_NOTES = 'Notas rápidas'
export const ATTACHMENTS = 'Adjuntos'
export const MAX_UPLOAD = 50 * 1024 * 1024

export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

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

export function displayName(fileName: string, kind: ItemKind): string {
  if (kind === 'note' || kind === 'board')
    return fileName.slice(0, fileName.length - extOf(fileName).length)
  return fileName
}

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
export const dirName = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

export function joinPath(...parts: string[]): string {
  const path = normalizePath(parts.filter(Boolean).join('/'))
  if (path === null) throw new Error('Ruta fuera de la bóveda.')
  return path
}

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

export function relativePath(fromDir: string, to: string): string {
  const a = fromDir ? fromDir.split('/') : []
  const b = to.split('/')
  let i = 0
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

export const vaultUrl = (path: string): string =>
  `vault://path/${path.split('/').map(encodeURIComponent).join('/')}`
