import { useCallback, useEffect, useState } from 'react'
import { applyPatch, type UiPatch, type UiValues } from '@shared/ui-state'

let cache: UiValues = {}
let pending: UiPatch = {}
let timer: number | null = null

const send = (): void => {
  if (timer !== null) window.clearTimeout(timer)
  timer = null
  if (!Object.keys(pending).length) return
  const changes = pending
  pending = {}
  try {
    window.api.ui.patch(changes)
  } catch {
    // sin main (pruebas): solo en memoria
  }
}

export const uiState = {
  get<T>(key: string, fallback: T): T {
    return key in cache ? (cache[key] as T) : fallback
  },

  set(key: string, value: unknown): void {
    const v = value === undefined ? null : value
    cache = applyPatch(cache, { [key]: v })
    pending[key] = v
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(send, 250)
  },

  flush: send
}

const LEGACY = [
  'shell.sidebar.',
  'ws.',
  'settings.tab',
  'today.expanded',
  'pipeline.',
  'props.collapsed.'
]
const MIGRATED = 'migrated.localStorage'

function migrateLocalStorage(): void {
  if (cache[MIGRATED]) return
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !LEGACY.some((p) => key.startsWith(p)) || key in cache) continue
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      let value: unknown = raw
      if (key === 'today.expanded') {
        try {
          value = JSON.parse(raw)
        } catch {
          continue
        }
      }
      uiState.set(key, value)
    }
  } catch {
    // localStorage no disponible: nada que copiar
  }
  uiState.set(MIGRATED, true)
}

export async function loadUiState(): Promise<void> {
  try {
    cache = await window.api.ui.load()
  } catch {
    cache = {}
  }
  migrateLocalStorage()
  window.addEventListener('beforeunload', send)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send()
  })
}

export function useUiState<T>(
  key: string,
  fallback: T,
  valid?: (value: unknown) => boolean
): [T, (next: T | ((prev: T) => T)) => void] {
  const read = useCallback(
    (k: string): T => {
      const stored = uiState.get<unknown>(k, undefined)
      return stored !== undefined && (!valid || valid(stored)) ? (stored as T) : fallback
    },
    // fallback y valid suelen ser literales: solo cuenta la clave
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [state, setState] = useState(() => ({ key, value: read(key) }))
  const value = state.key === key ? state.value : read(key)

  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setState((s) => {
        const prev = s.key === key ? s.value : read(key)
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        uiState.set(key, v)
        return { key, value: v }
      }),
    [key, read]
  )
  return [value, set]
}

export function useScrollMemory(
  ref: React.RefObject<HTMLElement | null>,
  key: string | null
): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !key) return
    const target = uiState.get<number>(key, 0)
    let done = !(target > 0)
    const restore = (): void => {
      if (done) return
      if (el.scrollHeight - el.clientHeight >= target - 1) {
        el.scrollTop = target
        done = true
      }
    }
    restore()
    const observer = new MutationObserver(restore)
    if (!done) observer.observe(el, { childList: true, subtree: true })
    const giveUp = window.setTimeout(() => {
      done = true
      observer.disconnect()
    }, 4000)

    let wait: number | null = null
    const onScroll = (): void => {
      if (!done && Math.abs(el.scrollTop - target) > 2 && el.scrollTop > 0) done = true
      if (wait !== null) window.clearTimeout(wait)
      wait = window.setTimeout(() => uiState.set(key, Math.round(el.scrollTop) || null), 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(giveUp)
      if (wait !== null) window.clearTimeout(wait)
      el.removeEventListener('scroll', onScroll)
    }
  }, [ref, key])
}
