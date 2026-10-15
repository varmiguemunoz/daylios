import { useCallback, useState } from 'react'
import { FolderOpen, Plus, Upload } from 'lucide-react'
import type { WorkspaceItem } from '@shared/workspace'
import { Breadcrumbs, IconButton, useContextMenu } from '../../ui'
import { Empty, ErrorNote, Section } from '../ui'
import { useLoad } from '../lib'
import { acceptsDrop, draggedItem, droppedPaths, hasFiles, openItem, ws } from '../workspace/lib'
import { useWorkspace } from '../workspace/context'
import { ItemList } from '../workspace/organisms/ItemViews'

export function ClientFiles({ folder }: { folder: string }): React.JSX.Element {
  const { go, actions } = useWorkspace()
  const menu = useContextMenu()
  const [current, setCurrent] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)

  const loadRoot = useCallback(() => ws.resolve(folder).catch(() => null), [folder])
  const { data: root, error: rootError } = useLoad(loadRoot)
  const folderId = current ?? root?.id ?? null
  const loadList = useCallback(
    () => (folderId ? ws.list(folderId) : Promise.resolve(null)),
    [folderId]
  )
  const { data: listing, error: listError } = useLoad(loadList)

  const start = listing?.crumbs.findIndex((c) => c.id === root?.id) ?? -1
  const crumbs = start >= 0 ? listing!.crumbs.slice(start) : []

  const dropInto = (target: string | null, e: React.DragEvent): void => {
    e.preventDefault()
    setDropping(false)
    if (!target) return
    const id = draggedItem(e)
    if (id) {
      if (id !== target) void actions.moveTo(id, target)
    } else if (hasFiles(e)) void actions.upload(target, droppedPaths(e))
  }

  const open = (item: WorkspaceItem): void =>
    item.kind === 'folder' ? setCurrent(item.id) : openItem(item, go)

  const openMenu = (item: WorkspaceItem, e: React.MouseEvent, anchor?: HTMLElement): void => {
    if (anchor) {
      e.stopPropagation()
      menu.openFrom(anchor, actions.itemMenu(item))
    } else menu.openAt(e, actions.itemMenu(item))
  }

  const items = listing?.items ?? []

  return (
    <Section
      title="Archivos"
      aside={
        folderId ? (
          <div className="flex gap-2">
            <IconButton
              label="Abrir en el Workspace"
              onClick={() => go({ name: 'workspace', folder: folderId })}
            >
              <FolderOpen size={16} />
            </IconButton>
            <IconButton label="Subir archivos" onClick={() => void actions.upload(folderId)}>
              <Upload size={16} />
            </IconButton>
            <button
              type="button"
              onClick={(e) => menu.openFrom(e.currentTarget, actions.folderMenu(folderId))}
              className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-ob-active px-3 text-[13px] font-medium text-ob-text transition-colors hover:bg-[#3f3f3f]"
            >
              <Plus size={15} />
              Nuevo
            </button>
          </div>
        ) : null
      }
    >
      <ErrorNote message={rootError ?? listError} />
      {crumbs.length > 1 && (
        <div className="mb-2">
          <Breadcrumbs
            items={crumbs}
            onSelect={(id) => setCurrent(id)}
            onDropOn={(id, e) => dropInto(id, e)}
          />
        </div>
      )}
      <div
        className="relative"
        onContextMenu={(e) => folderId && menu.openAt(e, actions.folderMenu(folderId))}
        onDragOver={(e) => {
          if (!acceptsDrop(e) || !folderId) return
          e.preventDefault()
          if (hasFiles(e)) setDropping(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropping(false)
        }}
        onDrop={(e) => dropInto(folderId, e)}
      >
        {dropping && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[6px] bg-ob-bg/80 shadow-[inset_0_0_0_2px_var(--color-ob-accent)]">
            <p className="text-list font-medium">Suelta para subir aquí</p>
          </div>
        )}
        {!root ? (
          <Empty
            title="Preparando la carpeta."
            hint="Aparecerá en cuanto el Workspace la detecte."
          />
        ) : items.length === 0 ? (
          <Empty
            title="Carpeta vacía."
            hint="Crea notas, boards o carpetas, o suelta archivos aquí. También aparece en el Workspace."
          />
        ) : (
          <ItemList
            items={items}
            onOpen={open}
            onMenu={openMenu}
            onDropOn={(target, e) => dropInto(target.id, e)}
            onDelete={actions.remove}
          />
        )}
      </div>
      {menu.element}
    </Section>
  )
}
