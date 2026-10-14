import { useEffect, useRef } from 'react'

/** Pila de capas abiertas (Drawer, Modal): Esc cierra solo la de arriba. */
const stack: number[] = []
let seq = 0

/** true si hay un Drawer o Modal abierto (los atajos de pantalla lo respetan). */
export const isOverlayOpen = (): boolean => stack.length > 0

/**
 * Capa abierta: registra Esc (en captura, antes que los atajos de la ventana),
 * enfoca el primer control y devuelve el foco al cerrar.
 */
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

/** Mantiene Tab dentro del panel. */
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
