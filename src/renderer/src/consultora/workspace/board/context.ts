import { createContext, useContext } from 'react'
import type { CanvasNode } from '@shared/canvas'

export interface BoardActions {
  patch: (id: string, change: Partial<CanvasNode>) => void

  openPath: (path: string) => void

  base: string

  editingId: string | null
  setEditing: (id: string | null) => void
}

export const BoardContext = createContext<BoardActions>({
  patch: () => undefined,
  openPath: () => undefined,
  base: '',
  editingId: null,
  setEditing: () => undefined
})

export const useBoard = (): BoardActions => useContext(BoardContext)
