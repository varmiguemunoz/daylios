import { createContext, useContext } from 'react'
import type { WorkspaceItem } from '@shared/workspace'
import type { Go } from '../lib'
import type { useItemActions } from './organisms/useItemActions'

/** Lo que comparten las piezas del workspace (explorador, paneles, buscador) y el marco. */
export interface WorkspaceState {
  go: Go
  actions: ReturnType<typeof useItemActions>
  /** Carpeta donde se crea lo nuevo: la abierta o la del archivo abierto. null = raíz. */
  folderId: string | null
  /** Elemento abierto (para resaltarlo en el explorador). */
  activeId: string | null
  /** El elemento abierto completo: su ruta va en la franja. */
  active: WorkspaceItem | null
  error: string | null
  setError: (message: string | null) => void
  /** Abre el selector de archivos (⌘O). */
  openSwitcher: () => void
  /** Menú «…» del archivo abierto (renombrar, mover, Finder, borrar). */
  openMore: (anchor: HTMLElement) => void
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace fuera de WorkspaceProvider')
  return ctx
}
