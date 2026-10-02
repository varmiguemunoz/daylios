import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, DAILY_LIMIT, type DayKey, type Task } from '@shared/tasks'
import { onDataChanged, onWindowShown, tasksApi } from './api'

export interface Undo {
  id: number
  message: string
  run: () => Promise<unknown>
}

export interface DayState {
  today: Task[]
  leftovers: Task[]
  loading: boolean
  error: string | null
  full: boolean
  undo: Undo | null
  add: (title: string) => Promise<boolean>
  /** Mueve la tarea `id` a la posición `index` de hoy (arrastrar o ⌥↑/⌥↓). */
  reorder: (id: string, index: number) => Promise<void>
  toggle: (task: Task) => Promise<void>
  remove: (task: Task) => Promise<void>
  bringToday: (task: Task) => Promise<void>
  bringAll: () => Promise<void>
  dismiss: (task: Task) => Promise<void>
  runUndo: () => Promise<void>
  clearUndo: () => void
  /** Vuelve a leer hoy y ayer (p. ej. al salir del detalle de una tarea). */
  reload: () => Promise<void>
}

/**
 * Estado de "hoy" + pendientes de ayer.
 * Cambios optimistas: se pinta primero y, si main falla, se recarga desde la base de datos.
 */
export function useDay(date: DayKey): DayState {
  const [today, setToday] = useState<Task[]>([])
  const [leftovers, setLeftovers] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const undoSeq = useRef(0)

  const yesterday = addDays(date, -1)

  const reload = useCallback(async () => {
    try {
      const [t, y] = await Promise.all([tasksApi.getDay(date), tasksApi.getDay(yesterday)])
      setToday(t)
      setLeftovers(y.filter((task) => !task.done))
      setError(null)
    } catch {
      setError('No pude leer tus tareas. Vuelve a abrir la ventana para reintentar.')
    } finally {
      setLoading(false)
    }
  }, [date, yesterday])

  // Recargar al montar, al abrir la ventana y cuando Claude cambia algo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void reload()
    const offShown = onWindowShown(() => void reload())
    const offChanged = onDataChanged(() => void reload())
    return () => {
      offShown()
      offChanged()
    }
  }, [reload])

  /** Ejecuta la llamada a main; si falla, avisa y recarga. Devuelve si tuvo éxito. */
  const safely = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn()
        return true
      } catch {
        setError('No se guardó el último cambio. Lo he revertido.')
        await reload()
        return false
      }
    },
    [reload]
  )

  const full = today.length >= DAILY_LIMIT

  const add = async (title: string): Promise<boolean> => {
    const clean = title.trim()
    if (!clean || full) return false
    return safely(async () => {
      const task = await tasksApi.add(date, clean)
      setToday((prev) => [...prev, task])
    })
  }

  const reorder = async (id: string, index: number): Promise<void> => {
    const from = today.findIndex((t) => t.id === id)
    if (from < 0) return
    const next = [...today]
    const [moved] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(index, next.length)), 0, moved)
    if (next.every((t, i) => t.id === today[i].id)) return
    setToday(next)
    await safely(() => tasksApi.reorder(date, next.map((t) => t.id)))
  }

  const toggle = async (task: Task): Promise<void> => {
    const done = !task.done
    setToday((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)))
    await safely(() => tasksApi.update(task.id, { done }))
  }

  /** Borra sin confirmar y ofrece deshacer. */
  const deleteWithUndo = async (task: Task, message: string): Promise<void> => {
    if (!(await safely(() => tasksApi.remove(task.id)))) return
    undoSeq.current += 1
    setUndo({ id: undoSeq.current, message, run: () => tasksApi.restore(task).then(reload) })
  }

  const remove = async (task: Task): Promise<void> => {
    setToday((prev) => prev.filter((t) => t.id !== task.id))
    await deleteWithUndo(task, 'Tarea eliminada')
  }

  const dismiss = async (task: Task): Promise<void> => {
    setLeftovers((prev) => prev.filter((t) => t.id !== task.id))
    await deleteWithUndo(task, 'Tarea de ayer soltada')
  }

  const bringToday = async (task: Task): Promise<void> => {
    if (full) return
    setLeftovers((prev) => prev.filter((t) => t.id !== task.id))
    await safely(async () => {
      const moved = await tasksApi.moveToDate(task.id, date)
      setToday((prev) => [...prev, moved])
    })
  }

  const bringAll = async (): Promise<void> => {
    if (await safely(() => tasksApi.carryOver(yesterday, date))) await reload()
  }

  // Estables (useCallback): App y UndoToast los usan en efectos.
  // Antes cambiaban en cada render y el temporizador del toast se reiniciaba sin parar.
  const runUndo = useCallback(async () => {
    if (!undo) return
    setUndo(null)
    await safely(undo.run)
  }, [undo, safely])

  const clearUndo = useCallback(() => setUndo(null), [])

  return {
    today,
    leftovers,
    loading,
    error,
    full,
    undo,
    add,
    reorder,
    toggle,
    remove,
    bringToday,
    bringAll,
    dismiss,
    runUndo,
    clearUndo,
    reload
  }
}
