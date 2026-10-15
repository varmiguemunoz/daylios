import { useCallback, useRef, useState } from 'react'

export const HISTORY_LIMIT = 60

export interface HistoryStack<T> {
  past: T[]
  future: T[]
}

export const emptyHistory = <T>(): HistoryStack<T> => ({ past: [], future: [] })

export function record<T>(h: HistoryStack<T>, snapshot: T, limit = HISTORY_LIMIT): HistoryStack<T> {
  return { past: [...h.past, snapshot].slice(-limit), future: [] }
}

export function back<T>(h: HistoryStack<T>, current: T): [HistoryStack<T>, T] | null {
  if (!h.past.length) return null
  return [{ past: h.past.slice(0, -1), future: [...h.future, current] }, h.past[h.past.length - 1]]
}

export function forward<T>(h: HistoryStack<T>, current: T): [HistoryStack<T>, T] | null {
  if (!h.future.length) return null
  return [
    { past: [...h.past, current], future: h.future.slice(0, -1) },
    h.future[h.future.length - 1]
  ]
}

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
  const stack = useRef<HistoryStack<T>>(emptyHistory())
  const [sizes, setSizes] = useState({ past: 0, future: 0 })
  const commit = useCallback((next: HistoryStack<T>) => {
    stack.current = next
    setSizes({ past: next.past.length, future: next.future.length })
  }, [])

  const checkpoint = useCallback(() => commit(record(stack.current, current())), [commit, current])

  const move = useCallback(
    (step: typeof back) => {
      const result = step(stack.current, current())
      if (!result) return
      commit(result[0])
      restore(result[1])
    },
    [commit, current, restore]
  )

  const undo = useCallback(() => move(back), [move])
  const redo = useCallback(() => move(forward), [move])

  return { checkpoint, undo, redo, canUndo: sizes.past > 0, canRedo: sizes.future > 0 }
}
