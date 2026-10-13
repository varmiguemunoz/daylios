import { useCallback, useRef, useState } from 'react'

const LIMIT = 60

/** Deshacer y rehacer por instantáneas (máximo 60). `checkpoint` antes de cada cambio. */
export function useHistory<T>(
  current: () => T,
  restore: (snapshot: T) => void
): {
  checkpoint: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  // Solo para que los botones sepan si hay algo que deshacer.
  const [sizes, setSizes] = useState({ past: 0, future: 0 })
  const sync = (): void => setSizes({ past: past.current.length, future: future.current.length })

  const checkpoint = useCallback(() => {
    past.current.push(current())
    if (past.current.length > LIMIT) past.current.shift()
    future.current = []
    sync()
  }, [current])

  const undo = useCallback(() => {
    const previous = past.current.pop()
    if (previous === undefined) return
    future.current.push(current())
    restore(previous)
    sync()
  }, [current, restore])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (next === undefined) return
    past.current.push(current())
    restore(next)
    sync()
  }, [current, restore])

  return { checkpoint, undo, redo, canUndo: sizes.past > 0, canRedo: sizes.future > 0 }
}
