import { createContext, useContext } from 'react'
import type { WorkspaceItem } from '@shared/workspace'
import type { Go } from '../lib'
import type { useItemActions } from './organisms/useItemActions'

export interface WorkspaceState {
  go: Go
  actions: ReturnType<typeof useItemActions>

  folderId: string | null

  activeId: string | null

  active: WorkspaceItem | null
  error: string | null
  setError: (message: string | null) => void

  openSwitcher: () => void

  openMore: (anchor: HTMLElement) => void
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace fuera de WorkspaceProvider')
  return ctx
}
