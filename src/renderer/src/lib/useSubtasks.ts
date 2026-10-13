import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '@shared/tasks'
import { errorMessage, tasksApi } from './api'

export interface SubtasksState {
  subtasks: Task[]
  /** Ya se leyeron al menos una vez (para no pintar «vacío» mientras carga). */
  loaded: boolean
  error: string | null
  add: (title: string) => Promise<boolean>
  toggle: (sub: Task) => void
  /** Mueve `id` a la posición `index`. */
  reorder: (id: string, index: number) => void
  completeAll: () => void
  /** La quita de la lista local; el borrado con Deshacer lo hace `useDay`. */
  drop: (sub: Task) => void
}

/**
 * Subtareas de una madre, con cambios optimistas: se pinta primero y, si main falla, se recargan.
 * `parentId` null = no carga nada (una subtarea no tiene subtareas).
 * `revision` sube cuando el día se recarga (deshacer, Claude): vuelve a leer.
 * `onChange` avisa al leer y tras cada cambio con la lista (la madre recalcula su «2/5»).
 */
export function useSubtasks(
  parentId: string | null,
  revision: number,
  onChange?: (subtasks: Task[]) => void
): SubtasksState {
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = useRef(onChange)

  useEffect(() => {
    changed.current = onChange
  }, [onChange])

  const load = useCallback(async () => {
    if (!parentId) return
    try {
      const list = (await tasksApi.get(parentId)).subtasks
      setSubtasks(list)
      changed.current?.(list)
      setLoaded(true)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [parentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void load()
  }, [load, revision])

  /** Aplica en local, avisa y llama a main; si falla, recarga. */
  const apply = (next: Task[], call: () => Promise<unknown>): void => {
    setSubtasks(next)
    changed.current?.(next)
    call()
      .then(() => setError(null))
      .catch((e) => {
        setError(errorMessage(e))
        void load()
      })
  }

  const add = async (title: string): Promise<boolean> => {
    if (!parentId) return false
    try {
      const sub = await tasksApi.addSubtask(parentId, title)
      const next = [...subtasks, sub]
      setSubtasks(next)
      changed.current?.(next)
      setError(null)
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const toggle = (sub: Task): void =>
    apply(
      subtasks.map((t) => (t.id === sub.id ? { ...t, done: !sub.done } : t)),
      () => tasksApi.update(sub.id, { done: !sub.done })
    )

  const reorder = (id: string, index: number): void => {
    if (!parentId) return
    const from = subtasks.findIndex((t) => t.id === id)
    if (from < 0) return
    const next = [...subtasks]
    const [moved] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(index, next.length)), 0, moved)
    if (next.every((t, i) => t.id === subtasks[i].id)) return
    apply(next, () =>
      tasksApi.reorderSubtasks(
        parentId,
        next.map((t) => t.id)
      )
    )
  }

  const completeAll = (): void => {
    if (!parentId) return
    apply(
      subtasks.map((t) => ({ ...t, done: true })),
      () => tasksApi.completeSubtasks(parentId)
    )
  }

  const drop = (sub: Task): void => {
    const next = subtasks.filter((t) => t.id !== sub.id)
    setSubtasks(next)
    changed.current?.(next)
  }

  return { subtasks, loaded, error, add, toggle, reorder, completeAll, drop }
}
