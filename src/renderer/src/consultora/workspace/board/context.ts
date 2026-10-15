import { createContext, useContext, useSyncExternalStore } from 'react'
import type { CanvasNode } from '@shared/canvas'

export interface BoardActions {
  patch: (id: string, change: Partial<CanvasNode>) => void
  openPath: (path: string) => void
  base: string
  setEditing: (id: string | null) => void
  readOnly: boolean
}

export const BoardContext = createContext<BoardActions>({
  patch: () => undefined,
  openPath: () => undefined,
  base: '',
  setEditing: () => undefined,
  readOnly: false
})

export const useBoard = (): BoardActions => useContext(BoardContext)

export interface EditingStore {
  get: () => string | null
  set: (id: string | null) => void
  subscribe: (listener: () => void) => () => void
}

export function createEditingStore(): EditingStore {
  let current: string | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (id) => {
      if (id === current) return
      current = id
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export const EditingContext = createContext<EditingStore>(createEditingStore())

export function useEditing(id: string): boolean {
  const store = useContext(EditingContext)
  return useSyncExternalStore(store.subscribe, () => store.get() === id)
}
