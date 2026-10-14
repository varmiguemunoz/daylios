import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownAZ,
  CalendarClock,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Upload
} from 'lucide-react'
import type { SearchHit, WorkspaceItem } from '@shared/workspace'
import { Breadcrumbs, IconButton, SearchField, SegmentedToggle, useContextMenu } from '../../../ui'
import { Button, Empty, ErrorNote } from '../../ui'
import { useLoad } from '../../lib'
import {
  KIND_ICON,
  acceptsDrop,
  draggedItem,
  droppedPaths,
  hasFiles,
  openItem,
  prefs,
  ws,
  type SortMode,
  type ViewMode
} from '../lib'
import { useWorkspace } from '../context'
import { ItemGrid, ItemList } from '../organisms/ItemViews'

export function FolderPane({ folderId }: { folderId: string | null }): React.JSX.Element {
  const { go, actions } = useWorkspace()
  const load = useCallback(() => ws.list(folderId), [folderId])
  const { data, error: loadError, reload } = useLoad(load)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [dropping, setDropping] = useState(false)
  const viewKey = `ws.view.${folderId ?? 'root'}`
  const [view, setView] = useState<ViewMode>(() => (prefs.get(viewKey) as ViewMode) || 'list')
  const [sort, setSort] = useState<SortMode>(() => (prefs.get('ws.sort') as SortMode) || 'name')
  const menu = useContextMenu()
  useEffect(() => {
    if (query.trim().length < 2) return
    const t = setTimeout(() => {
      ws.search(query)
        .then(setHits)
        .catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  const items = useMemo(() => {
    const list = [...(data?.items ?? [])]
    if (sort === 'date') {
      const folderFirst = (x: WorkspaceItem): number => (x.kind === 'folder' ? 0 : 1)
      list.sort((a, b) => folderFirst(a) - folderFirst(b) || b.updatedAt.localeCompare(a.updatedAt))
    }
    return list
  }, [data, sort])

  const changeView = (v: ViewMode): void => {
    setView(v)
    prefs.set(viewKey, v)
  }
  const changeSort = (): void => {
    const next = sort === 'name' ? 'date' : 'name'
    setSort(next)
    prefs.set('ws.sort', next)
  }

  const dropInto = (target: string | null, e: React.DragEvent): void => {
    e.preventDefault()
    setDropping(false)
    const id = draggedItem(e)
    if (id) {
      if (id !== target) void actions.moveTo(id, target)
    } else if (hasFiles(e)) void actions.upload(target, droppedPaths(e))
  }

  const openMenu = (item: WorkspaceItem, e: React.MouseEvent, anchor?: HTMLElement): void => {
    if (anchor) {
      e.stopPropagation()
      menu.openFrom(anchor, actions.itemMenu(item))
    } else menu.openAt(e, actions.itemMenu(item))
  }

  const searching = query.trim().length >= 2
  const viewProps = {
    onOpen: (item: WorkspaceItem) => openItem(item, go),
    onMenu: openMenu,
    onDropOn: (folder: WorkspaceItem, e: React.DragEvent) => dropInto(folder.id, e),
    onDelete: actions.remove
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="@container flex flex-wrap items-center gap-2 px-6 pt-5">
        <div className="min-w-0 flex-1">
          <Breadcrumbs
            items={data?.crumbs ?? [{ id: null, name: 'Workspace' }]}
            onSelect={(id) => go({ name: 'workspace', folder: id })}
            onDropOn={(id, e) => dropInto(id, e)}
          />
        </div>
        <div className="flex w-56 min-w-0">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Filtrar"
            label="Buscar en el workspace"
          />
        </div>
        <SegmentedToggle
          label="Vista"
          value={view}
          onChange={changeView}
          options={[
            { id: 'list', label: 'Lista', icon: ListIcon },
            { id: 'grid', label: 'Cuadrícula', icon: LayoutGrid }
          ]}
        />
        <IconButton
          label={
            sort === 'name'
              ? 'Ordenado por nombre · cambiar a fecha'
              : 'Ordenado por fecha · cambiar a nombre'
          }
          onClick={changeSort}
        >
          {sort === 'name' ? <ArrowDownAZ size={16} /> : <CalendarClock size={16} />}
        </IconButton>
        <IconButton label="Subir archivos" onClick={() => void actions.upload(folderId)}>
          <Upload size={16} />
        </IconButton>
        <button
          type="button"
          onClick={(e) => menu.openFrom(e.currentTarget, actions.folderMenu(folderId))}
          className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-ob-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#7a4fe0] disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={16} />
          Nuevo
        </button>
      </header>

      <div className="px-6">
        <ErrorNote message={loadError} />
        {loadError && !data && (
          <div className="mt-2">
            <Button onClick={() => void reload()}>Reintentar</Button>
          </div>
        )}
      </div>

      <main
        className="@container scroll-area relative mt-5 min-h-0 flex-1 overflow-y-auto pb-16 pl-6"
        onContextMenu={(e) => menu.openAt(e, actions.folderMenu(folderId))}
        onDragOver={(e) => {
          if (!acceptsDrop(e)) return
          e.preventDefault()
          if (hasFiles(e)) setDropping(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropping(false)
        }}
        onDrop={(e) => dropInto(folderId, e)}
      >
        {dropping && (
          <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl bg-ob-bg/80 shadow-[inset_0_0_0_2px_var(--color-ob-accent)]">
            <p className="text-list font-medium">Suelta para subir aquí</p>
          </div>
        )}

        {searching ? (
          <SearchResults hits={hits} onOpen={(item) => openItem(item, go)} onMenu={openMenu} />
        ) : !data && !loadError ? (
          <Skeleton />
        ) : data && items.length === 0 ? (
          <div className="flex flex-col gap-3">
            <Empty
              title="Carpeta vacía."
              hint="Crea una nota, un board o una carpeta, o suelta archivos de Finder aquí."
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void actions.newNote(folderId)}>Nueva nota</Button>
              <Button onClick={() => void actions.newBoard(folderId)}>Nuevo board</Button>
              <Button onClick={() => actions.newFolder(folderId)}>Nueva carpeta</Button>
              <Button onClick={() => void actions.upload(folderId)}>Subir archivos</Button>
            </div>
          </div>
        ) : view === 'grid' ? (
          <ItemGrid items={items} {...viewProps} />
        ) : (
          <ItemList items={items} {...viewProps} />
        )}
      </main>
      {menu.element}
    </div>
  )
}

function SearchResults({
  hits,
  onOpen,
  onMenu
}: {
  hits: SearchHit[] | null
  onOpen: (item: WorkspaceItem) => void
  onMenu: (item: WorkspaceItem, e: React.MouseEvent) => void
}): React.JSX.Element {
  if (!hits) return <Skeleton />
  if (!hits.length)
    return (
      <Empty
        title="Nada coincide."
        hint="Busca por nombre de archivo o por texto dentro de las notas."
      />
    )
  return (
    <ul className="overflow-hidden rounded-[6px] border border-ob-border [&>li+li]:border-t [&>li+li]:border-ob-border">
      {hits.map(({ item, snippet }) => {
        const Icon = KIND_ICON[item.kind]
        return (
          <li key={item.id} onContextMenu={(e) => onMenu(item, e)}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ob-hover focus-visible:bg-ob-hover"
            >
              <Icon
                size={17}

                className="mt-0.5 shrink-0 text-ob-muted"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-list font-medium">{item.name}</span>
                <span className="block truncate text-caption text-ob-muted">
                  {snippet || item.path}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Skeleton(): React.JSX.Element {
  return (
    <ul aria-busy="true" aria-label="Cargando" className="flex flex-col gap-1">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-8 animate-pulse rounded-[6px] border border-ob-border/60" />
      ))}
    </ul>
  )
}
