import { createContext, useContext } from 'react'
import type { Go } from '../lib'
import type { useItemActions } from './organisms/useItemActions'

/** Lo que comparten las piezas del workspace (explorador, paneles, buscador). */
export interface WorkspaceState {
  go: Go
  actions: ReturnType<typeof useItemActions>
  /** Carpeta donde se crea lo nuevo: la abierta o la del archivo abierto. null = raíz. */
  folderId: string | null
  /** Elemento abierto (para resaltarlo en el explorador). */
  activeId: string | null
  setError: (message: string | null) => void
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace fuera de WorkspaceApp')
  return ctx
}
