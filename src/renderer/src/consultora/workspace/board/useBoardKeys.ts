import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NUDGE, NUDGE_BIG } from './viewport'

export interface BoardKeyHandlers {
  readOnly: boolean
  nudge: (dx: number, dy: number) => void
  deselect: () => void
  fit: () => void
  zoomToSelection: () => void
  undo: () => void
  redo: () => void
  selectAll: () => void
  group: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  duplicate: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

export interface Modifiers {
  alt: boolean
  shift: boolean
  ctrl: boolean
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

const typing = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null
  return Boolean(
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  )
}

function action(e: KeyboardEvent, h: BoardKeyHandlers): (() => void) | null {
  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()
  const edit = (fn: () => void): (() => void) | null => (h.readOnly ? null : fn)
  if (e.key.startsWith('Arrow') && !mod) {
    const [dx, dy] = ARROWS[e.key] ?? [0, 0]
    const step = e.shiftKey ? NUDGE_BIG : NUDGE
    return edit(() => h.nudge(dx * step, dy * step))
  }
  if (e.key === 'Escape') return h.deselect
  if (e.shiftKey && e.code === 'Digit1') return h.fit
  if (e.shiftKey && e.code === 'Digit2') return h.zoomToSelection
  if (!mod) return null
  if (key === 'z') return edit(e.shiftKey ? h.redo : h.undo)
  if (key === 'y') return edit(h.redo)
  if (key === 'a') return h.selectAll
  if (key === 'g') return edit(h.group)
  if (key === 'x') return edit(h.cut)
  if (key === 'v') return edit(h.paste)
  if (key === 'd') return edit(h.duplicate)
  if (key === '=' || key === '+') return h.zoomIn
  if (key === '-') return h.zoomOut
  if (key === '0') return h.zoomReset
  return null
}

export function useModifiers(): { free: boolean; mods: React.RefObject<Modifiers> } {
  const mods = useRef<Modifiers>({ alt: false, shift: false, ctrl: false })
  const [free, setFree] = useState(false)
  useEffect(() => {
    const track = (e: KeyboardEvent): void => {
      mods.current = { alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey }
      setFree(e.ctrlKey)
    }
    const reset = (): void => {
      mods.current = { alt: false, shift: false, ctrl: false }
      setFree(false)
    }
    window.addEventListener('keydown', track)
    window.addEventListener('keyup', track)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', track)
      window.removeEventListener('keyup', track)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return { free, mods }
}

export function useBoardKeys(handlers: BoardKeyHandlers): void {
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (typing(e.target) || document.querySelector('[role="dialog"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') return latest.current.copy()
      const run = action(e, latest.current)
      if (!run) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
