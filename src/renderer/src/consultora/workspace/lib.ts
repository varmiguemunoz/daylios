import { File, FileText, Folder, Image as ImageIcon, Shapes, type LucideIcon } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { ExplorerTree, FolderNode, ItemKind, WorkspaceItem } from '@shared/workspace'
import type { Go } from '../lib'
import { uiState } from '../../lib/ui-state'

export const ws = window.api.workspace

export const itemUrl = (id: string, version?: string): string =>
  `vault://item/${encodeURIComponent(id)}${version ? `?v=${encodeURIComponent(version)}` : ''}`

export const KIND_ICON: Record<ItemKind, LucideIcon> = {
  folder: Folder,
  note: FileText,
  board: Shapes,
  image: ImageIcon,
  file: File
}

export const KIND_LABEL: Record<ItemKind, string> = {
  folder: 'Carpeta',
  note: 'Nota',
  board: 'Board',
  image: 'Imagen',
  file: 'Archivo'
}

export function openItem(item: WorkspaceItem, go: Go): void {
  switch (item.kind) {
    case 'folder':
      return go({ name: 'workspace', folder: item.id })
    case 'note':
      return go({ name: 'ws-note', id: item.id })
    case 'board':
      return go({ name: 'ws-board', id: item.id })
    case 'image':
      return go({ name: 'ws-image', id: item.id })
    default:
      void ws.openExternal(item.id).catch(() => undefined)
  }
}

// ---- arrastrar dentro del workspace ----

export const DRAG_TYPE = 'application/x-daylios-item'

export const dragItem = (e: React.DragEvent, id: string): void => {
  e.dataTransfer.setData(DRAG_TYPE, id)
  e.dataTransfer.effectAllowed = 'move'
}

export const draggedItem = (e: React.DragEvent): string | null =>
  e.dataTransfer.getData(DRAG_TYPE) || null

export const hasFiles = (e: React.DragEvent): boolean => [...e.dataTransfer.types].includes('Files')

export const acceptsDrop = (e: React.DragEvent): boolean =>
  hasFiles(e) || [...e.dataTransfer.types].includes(DRAG_TYPE)

export const droppedPaths = (e: React.DragEvent): string[] =>
  [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean)

// ---- preferencias por carpeta (localStorage puede fallar: entonces no se recuerdan) ----

export type ViewMode = 'list' | 'grid'
export type SortMode = 'name' | 'date'

export const prefs = {
  get(key: string): string | null {
    const value = uiState.get<unknown>(key, null)
    return value === null ? null : typeof value === 'string' ? value : JSON.stringify(value)
  },
  set(key: string, value: string): void {
    uiState.set(key, value)
  }
}

const sizeFmt = (n: number): string =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`

export const itemMeta = (item: WorkspaceItem): string =>
  item.kind === 'folder' ? KIND_LABEL.folder : `${KIND_LABEL[item.kind]} · ${sizeFmt(item.size)}`

export function flattenExplorer(tree: ExplorerTree): WorkspaceItem[] {
  const out = [...tree.files]
  const walk = (nodes: FolderNode[]): void => {
    for (const n of nodes) {
      out.push(...(n.items ?? []))
      walk(n.children)
    }
  }
  walk(tree.folders)
  return out
}

export function fuzzyScore(text: string, query: string): number {
  const t = normalizeName(text)
  if (t.includes(query)) return 1000 - t.indexOf(query)
  let at = -1
  let points = 0
  for (const ch of query) {
    const next = t.indexOf(ch, at + 1)
    if (next < 0) return -1
    points += next === at + 1 ? 3 : 1
    at = next
  }
  return points
}
