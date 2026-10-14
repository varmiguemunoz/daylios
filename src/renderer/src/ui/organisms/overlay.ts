import { useEffect, useRef } from 'react'

const stack: number[] = []
let seq = 0

export const isOverlayOpen = (): boolean => stack.length > 0

export function useOverlay(
  open: boolean,
  onClose: () => void,
  panel: React.RefObject<HTMLElement | null>
): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const id = ++seq
    stack.push(id)
    const previous = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>(
        '[autofocus], input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
      )
      ;(first ?? panel.current)?.focus()
    })

    const onKey = (e: KeyboardEvent): void => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close.current()
      } else if (e.key === 'Tab' && panel.current) trapTab(e, panel.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      stack.splice(stack.indexOf(id), 1)
      previous?.focus?.()
    }
  }, [open, panel])
}

function trapTab(e: KeyboardEvent, panel: HTMLElement): void {
  const items = [
    ...panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'
    )
  ]
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
