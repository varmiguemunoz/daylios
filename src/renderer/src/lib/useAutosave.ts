import { useCallback, useEffect, useState } from 'react'

export type SaveStatus = 'saved' | 'saving' | 'error'

export function useAutosave(
  value: string,
  save: (value: string) => Promise<unknown>
): { status: SaveStatus; flush: () => Promise<void> } {
  const [savedValue, setSavedValue] = useState(value)
  const [failed, setFailed] = useState(false)

  const flush = useCallback(async () => {
    if (value === savedValue) return
    try {
      await save(value)
      setSavedValue(value)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [value, savedValue, save])

  useEffect(() => {
    const timer = window.setTimeout(() => void flush(), 500)
    return () => window.clearTimeout(timer)
  }, [flush])

  const status: SaveStatus = failed ? 'error' : value === savedValue ? 'saved' : 'saving'
  return { status, flush }
}
