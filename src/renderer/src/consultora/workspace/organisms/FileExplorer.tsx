import { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownAZ,
  CalendarClock,
  ChevronRight,
  ChevronsDownUp,
  FilePlus2,
  FolderPlus
} from 'lucide-react'
import type { FolderNode, WorkspaceItem } from '@shared/workspace'
import { extOf } from '@shared/workspace'
import { useContextMenu, type MenuEntry } from '../../../ui'
import { useLoad } from '../../lib'
import {
  acceptsDrop,
  dragItem,
  draggedItem,
  droppedPaths,
  hasFiles,
  openItem,
  prefs,
  ws,
  type SortMode
} from '../lib'
import { useWorkspace } from '../context'
import { RibbonButton } from './ObsidianShell'

const OPEN_KEY = 'ws.explorer.open-folders'
const SORT_KEY = 'ws.explorer.sort'

function readOpen(): Set<string> {
  try {
    return new Set(JSON.parse(prefs.get(OPEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Etiqueta pequeña para lo que no es nota (como Obsidian: «CANVAS», «PNG»). */
const badge = (item: WorkspaceItem): string | null =>
  item.kind === 'note' ? null : item.kind === 'board' ? 'canvas' : extOf(item.path).slice(1) || null

/** Nombre sin la extensión que ya dice la etiqueta. */
const label = (item: WorkspaceItem): string => {
  if (item.kind === 'note' || item.kind === 'board') return item.name
  const ext = extOf(item.name)
  return ext ? item.name.slice(0, -ext.length) : item.name
}

/** Explorador de archivos estilo Obsidian: carpetas y archivos en un árbol compacto. */
export function FileExplorer({ activePath }: { activePath: string }): React.JSX.Element {
  const { go, actions, activeId, folderId } = useWorkspace()
  const load = useCallback(() => ws.explorer(), [])
  const { data } = useLoad(load)
  const [open, setOpen] = useState<Set<string>>(readOpen)
  const [sort, setSort] = useState<SortMode>(() => (prefs.get(SORT_KEY) as SortMode) || 'name')
  const [over, setOver] = useState<string | null>(null)
  const menu = useContextMenu()

  const persist = (next: Set<string>): void => {
    setOpen(next)
    prefs.set(OPEN_KEY, JSON.stringify([...next]))
  }
  const toggle = (id: string, value?: boolean): void => {
    const next = new Set(open)
    if (value ?? !next.has(id)) next.add(id)
    else next.delete(id)
    persist(next)
  }

  const sorted = useMemo(() => {
    const byDate = (a: WorkspaceItem, b: WorkspaceItem): number =>
      b.updatedAt.localeCompare(a.updatedAt)
    const files = (list: WorkspaceItem[] = []): WorkspaceItem[] =>
      sort === 'date' ? [...list].sort(byDate) : list
    return { files, folders: data?.folders ?? [], root: files(data?.files) }
  }, [data, sort])

  // Los ancestros de lo abierto se ven siempre.
  const expanded = (node: FolderNode): boolean =>
    open.has(node.id) || activePath.startsWith(`${node.path}/`)

  const drop = (target: string | null, e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    const id = draggedItem(e)
    if (id) {
      if (id !== target) void actions.moveTo(id, target)
    } else if (hasFiles(e)) void actions.upload(target, droppedPaths(e))
  }

  const dropZone = (key: string, target: string | null): React.HTMLAttributes<HTMLElement> => ({
    onDragOver: (e) => {
      if (!acceptsDrop(e)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(key)
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e) => drop(target, e)
  })

  const folderMenu = (node: FolderNode, parentId: string | null): MenuEntry[] => {
    const item: WorkspaceItem = {
      id: node.id,
      kind: 'folder',
      path: node.path,
      name: node.name,
      parentId,
      size: 0,
      createdAt: '',
      updatedAt: ''
    }
    const [, ...rest] = actions.itemMenu(item) // «Abrir» de una carpeta = ver su contenido
    return [
      { label: 'Ver contenido', onSelect: () => go({ name: 'workspace', folder: node.id }) },
      ...rest
    ]
  }

  const rowClass = (active: boolean, key: string): string =>
    `flex h-[26px] w-full min-w-0 items-center gap-1 rounded-[4px] pr-2 text-left text-[13px] transition-colors ${
      over === key
        ? 'bg-ob-accent/20 text-ob-text'
        : active
          ? 'bg-ob-active text-ob-text'
          : 'text-ob-muted hover:bg-ob-hover hover:text-ob-text'
    }`

  const fileRow = (item: WorkspaceItem, depth: number): React.JSX.Element => {
    const tag = badge(item)
    return (
      <li key={item.id}>
        <button
          type="button"
          draggable
          onDragStart={(e) => dragItem(e, item.id)}
          onClick={() => openItem(item, go)}
          onContextMenu={(e) => menu.openAt(e, actions.itemMenu(item))}
          aria-current={item.id === activeId ? 'page' : undefined}
          style={{ paddingLeft: 8 + depth * 16 + 16 }}
          className={rowClass(item.id === activeId, item.id)}
        >
          <span className="min-w-0 flex-1 truncate">{label(item)}</span>
          {tag && (
            <span className="shrink-0 rounded-[3px] bg-ob-hover px-1 text-[10px] leading-4 font-semibold tracking-wide text-ob-faint uppercase">
              {tag}
            </span>
          )}
        </button>
      </li>
    )
  }

  const folderRow = (
    node: FolderNode,
    depth: number,
    parentId: string | null
  ): React.JSX.Element => {
    const isOpen = expanded(node)
    const sortedFolders = node.children
    const files = sorted.files(node.items)
    return (
      <li key={node.id}>
        <button
          type="button"
          draggable
          onDragStart={(e) => dragItem(e, node.id)}
          onClick={() => toggle(node.id, !isOpen)}
          onContextMenu={(e) => menu.openAt(e, folderMenu(node, parentId))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') toggle(node.id, true)
            if (e.key === 'ArrowLeft') toggle(node.id, false)
          }}
          aria-expanded={isOpen}
          style={{ paddingLeft: 8 + depth * 16 }}
          className={rowClass(node.id === activeId, node.id)}
          {...dropZone(node.id, node.id)}
        >
          <ChevronRight
            size={13}
            strokeWidth={2.25}
            aria-hidden
            className={`shrink-0 text-ob-faint transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
          />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
        {isOpen && (sortedFolders.length > 0 || files.length > 0) && (
          // Guía vertical de la carpeta, como Obsidian.
          <ul
            style={{
              backgroundImage: 'linear-gradient(var(--color-ob-border), var(--color-ob-border))',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1px 100%',
              backgroundPosition: `${8 + depth * 16 + 6}px 0`
            }}
          >
            {sortedFolders.map((c) => folderRow(c, depth + 1, node.id))}
            {files.map((f) => fileRow(f, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  const collapseAll = (): void => persist(new Set())
  const changeSort = (): void => {
    const next: SortMode = sort === 'name' ? 'date' : 'name'
    setSort(next)
    prefs.set(SORT_KEY, next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-center gap-0.5 px-2">
        <RibbonButton label="Nueva nota" onClick={() => void actions.newNote(folderId)}>
          <FilePlus2 size={15} />
        </RibbonButton>
        <RibbonButton label="Nueva carpeta" onClick={() => actions.newFolder(folderId)}>
          <FolderPlus size={15} />
        </RibbonButton>
        <RibbonButton
          label={sort === 'name' ? 'Ordenado por nombre' : 'Ordenado por fecha'}
          onClick={changeSort}
        >
          {sort === 'name' ? <ArrowDownAZ size={15} /> : <CalendarClock size={15} />}
        </RibbonButton>
        <RibbonButton label="Plegar todo" onClick={collapseAll}>
          <ChevronsDownUp size={15} />
        </RibbonButton>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-y-auto px-2 pb-8 ${over === 'root' ? 'bg-ob-accent/10' : ''}`}
        onContextMenu={(e) => menu.openAt(e, actions.folderMenu(null))}
        {...dropZone('root', null)}
      >
        <ul className="flex flex-col">
          {sorted.folders.map((n) => folderRow(n, 0, null))}
          {sorted.root.map((f) => fileRow(f, 0))}
        </ul>
        {data && !sorted.folders.length && !sorted.root.length && (
          <p className="px-2 pt-2 text-[13px] text-ob-faint">
            Sin archivos. Crea una nota o suelta archivos aquí.
          </p>
        )}
      </div>
      {menu.element}
    </div>
  )
}
