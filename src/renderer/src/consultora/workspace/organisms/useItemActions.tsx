import { useState } from 'react'
import {
  ExternalLink,
  FilePlus2,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Pencil,
  Shapes,
  Trash2,
  Upload
} from 'lucide-react'
import type { WorkspaceItem } from '@shared/workspace'
import type { MenuEntry } from '../../../ui'
import { attempt, type Go } from '../../lib'
import { openItem, ws } from '../lib'
import { NameModal } from './NameModal'
import { DeleteItemModal } from './DeleteItemModal'
import { FolderPicker } from './FolderPicker'

type Dialog =
  | { kind: 'rename'; item: WorkspaceItem }
  | { kind: 'move'; item: WorkspaceItem }
  | { kind: 'delete'; item: WorkspaceItem }
  | { kind: 'folder'; parentId: string | null }
  | null

const ICON = 15

/**
 * Acciones del workspace en un solo sitio: menús contextuales, crear, subir, renombrar, mover y borrar,
 * con sus diálogos. La usan la vista de carpeta, el árbol y las pantallas de nota, board e imagen.
 */
export function useItemActions(
  go: Go,
  onError: (message: string | null) => void,
  /** Tras borrar el elemento abierto (p. ej. volver atrás). */
  onDeleted?: (item: WorkspaceItem) => void
): {
  dialogs: React.JSX.Element | null
  itemMenu: (item: WorkspaceItem) => MenuEntry[]
  folderMenu: (folderId: string | null) => MenuEntry[]
  newNote: (folderId: string | null) => Promise<void>
  newBoard: (folderId: string | null) => Promise<void>
  newFolder: (folderId: string | null) => void
  upload: (folderId: string | null, paths?: string[]) => Promise<void>
  moveTo: (id: string, folderId: string | null) => Promise<void>
  rename: (item: WorkspaceItem) => void
  remove: (item: WorkspaceItem) => void
} {
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = (): void => setDialog(null)

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    const failed = await attempt(fn)
    onError(failed)
    return !failed
  }

  const newNote = async (folderId: string | null): Promise<void> => {
    const box: { item?: WorkspaceItem } = {}
    const ok = await run(async () => {
      box.item = await ws.createNote(folderId)
    })
    if (ok && box.item) openItem(box.item, go)
  }

  const newBoard = async (folderId: string | null): Promise<void> => {
    const box: { item?: WorkspaceItem } = {}
    const ok = await run(async () => {
      box.item = await ws.createBoard(folderId)
    })
    if (ok && box.item) openItem(box.item, go)
  }

  /** Sin rutas: abre el diálogo del sistema. */
  const upload = async (folderId: string | null, paths?: string[]): Promise<void> => {
    const files = paths ?? (await ws.pickFiles())
    if (files.length) await run(() => ws.upload(folderId, files))
  }

  const moveTo = async (id: string, folderId: string | null): Promise<void> => {
    await run(() => ws.move(id, folderId))
  }

  const itemMenu = (item: WorkspaceItem): MenuEntry[] => [
    { label: 'Abrir', icon: <FolderOpen size={ICON} />, onSelect: () => openItem(item, go) },
    {
      label: 'Renombrar',
      icon: <Pencil size={ICON} />,
      onSelect: () => setDialog({ kind: 'rename', item })
    },
    {
      label: 'Mover a…',
      icon: <FolderInput size={ICON} />,
      onSelect: () => setDialog({ kind: 'move', item })
    },
    {
      label: 'Mostrar en Finder',
      icon: <ExternalLink size={ICON} />,
      onSelect: () => void run(() => ws.reveal(item.id))
    },
    ...(item.kind === 'folder' ? [null, ...folderMenu(item.id)] : []),
    null,
    {
      label: 'Borrar',
      icon: <Trash2 size={ICON} />,
      danger: true,
      onSelect: () => setDialog({ kind: 'delete', item })
    }
  ]

  const folderMenu = (folderId: string | null): MenuEntry[] => [
    {
      label: 'Nueva nota',
      icon: <FilePlus2 size={ICON} />,
      onSelect: () => void newNote(folderId)
    },
    { label: 'Nuevo board', icon: <Shapes size={ICON} />, onSelect: () => void newBoard(folderId) },
    {
      label: 'Nueva carpeta',
      icon: <FolderPlus size={ICON} />,
      onSelect: () => setDialog({ kind: 'folder', parentId: folderId })
    },
    {
      label: 'Subir archivos…',
      icon: <Upload size={ICON} />,
      onSelect: () => void upload(folderId)
    }
  ]

  const dialogs = !dialog ? null : dialog.kind === 'rename' ? (
    <NameModal
      title="Renombrar"
      label="Nombre"
      initial={dialog.item.name}
      confirmLabel="Renombrar"
      onSubmit={(name) => attempt(() => ws.rename(dialog.item.id, name))}
      onClose={close}
    />
  ) : dialog.kind === 'folder' ? (
    <NameModal
      title="Nueva carpeta"
      label="Nombre de la carpeta"
      confirmLabel="Crear"
      onSubmit={(name) => attempt(() => ws.createFolder(dialog.parentId, name))}
      onClose={close}
    />
  ) : dialog.kind === 'move' ? (
    <FolderPicker
      item={dialog.item}
      onClose={close}
      onPick={(folderId) => {
        close()
        void moveTo(dialog.item.id, folderId)
      }}
    />
  ) : (
    <DeleteItemModal
      item={dialog.item}
      onClose={close}
      onDeleted={() => {
        close()
        onError(null)
        onDeleted?.(dialog.item)
      }}
    />
  )

  return {
    dialogs,
    itemMenu,
    folderMenu,
    newNote,
    newBoard,
    newFolder: (parentId) => setDialog({ kind: 'folder', parentId }),
    upload,
    moveTo,
    rename: (item) => setDialog({ kind: 'rename', item }),
    remove: (item) => setDialog({ kind: 'delete', item })
  }
}
