import { useCallback, useEffect, useRef, useState } from 'react'
import type { Definition } from '@shared/automations'
import { errorMessage } from '../../lib/api'

const automations = window.api.automations
const SAVE_MS = 800
const HISTORY = 50

interface History {
  past: Definition[]
  present: Definition
  future: Definition[]
}

export interface AutomationDraft {
  def: Definition
  saving: boolean
  error: string | null
  canUndo: boolean
  canRedo: boolean
  apply: (change: (def: Definition) => Definition) => string | null
  undo: () => void
  redo: () => void
  reset: (def: Definition) => void
  flush: () => Promise<void>
}

export function useAutomationDraft(id: string, initial: Definition): AutomationDraft {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<Definition | null>(null)
  const timer = useRef<number | null>(null)

  const save = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    if (!next) return
    pending.current = null
    setSaving(true)
    try {
      await automations.saveDraft(id, next)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }, [id])

  const schedule = useCallback(
    (next: Definition) => {
      pending.current = next
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void save(), SAVE_MS)
    },
    [save]
  )

  useEffect(() => () => void save(), [save])

  const apply = useCallback(
    (change: (d: Definition) => Definition): string | null => {
      let next: Definition
      try {
        next = change(history.present)
      } catch (e) {
        return errorMessage(e)
      }
      if (next === history.present) return null
      setHistory((h) => ({
        past: [...h.past.slice(-(HISTORY - 1)), h.present],
        present: next,
        future: []
      }))
      schedule(next)
      return null
    },
    [history.present, schedule]
  )

  const undo = useCallback(() => {
    const target = history.past.at(-1)
    if (!target) return
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      present: target,
      future: [h.present, ...h.future]
    }))
    schedule(target)
  }, [history.past, schedule])

  const redo = useCallback(() => {
    const target = history.future[0]
    if (!target) return
    setHistory((h) => ({
      past: [...h.past, h.present],
      present: target,
      future: h.future.slice(1)
    }))
    schedule(target)
  }, [history.future, schedule])

  const reset = useCallback((next: Definition) => {
    pending.current = null
    setHistory({ past: [], present: next, future: [] })
  }, [])

  return {
    def: history.present,
    saving,
    error,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    apply,
    undo,
    redo,
    reset,
    flush: save
  }
}
