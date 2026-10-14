import { File, FileText, Folder, Image as ImageIcon, Shapes, type LucideIcon } from 'lucide-react'
import { normalizeName } from '@shared/consultora'
import type { ExplorerTree, FolderNode, ItemKind, WorkspaceItem } from '@shared/workspace'
import type { Go } from '../lib'

/** Puente a main (ver src/preload). */
export const ws = window.api.workspace

/** URL de un elemento de la bóveda para `<img>` (protocolo `vault://`, validado en main). */
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

/** Abre un elemento: carpeta, nota, board e imagen en la app; otros archivos con su app de macOS. */
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

/** Tipo de dato propio para arrastrar elementos (no se confunde con archivos de Finder). */
export const DRAG_TYPE = 'application/x-daylios-item'

export const dragItem = (e: React.DragEvent, id: string): void => {
  e.dataTransfer.setData(DRAG_TYPE, id)
  e.dataTransfer.effectAllowed = 'move'
}

export const draggedItem = (e: React.DragEvent): string | null =>
  e.dataTransfer.getData(DRAG_TYPE) || null

/** Hay archivos de Finder en el arrastre. */
export const hasFiles = (e: React.DragEvent): boolean => [...e.dataTransfer.types].includes('Files')

/** Se arrastra algo que una carpeta puede recibir. */
export const acceptsDrop = (e: React.DragEvent): boolean =>
  hasFiles(e) || [...e.dataTransfer.types].includes(DRAG_TYPE)

/** Rutas en disco de los archivos soltados desde Finder. */
export const droppedPaths = (e: React.DragEvent): string[] =>
  [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean)

// ---- preferencias por carpeta (localStorage puede fallar: entonces no se recuerdan) ----

export type ViewMode = 'list' | 'grid'
export type SortMode = 'name' | 'date'

export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // sin persistencia
    }
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

/** Todos los archivos del árbol del explorador, en una lista. */
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

/** Coincidencia difusa: las letras de la búsqueda aparecen en orden. Más puntos si van seguidas. */
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
