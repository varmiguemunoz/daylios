import { useEffect, useRef, useState } from 'react'
import { isOverlayOpen } from '../ui'

/** Pulsación larga para arrastrar la vista del tablero. */
export const HOLD_MS = 500
/** Si el puntero se mueve más que esto antes de cumplirse la pulsación, no se activa. */
const SLOP_PX = 6

/**
 * Navegación horizontal de un tablero con scroll:
 * - ← / → desplazan una columna; ⇧← / ⇧→ al inicio o al final (si no se está escribiendo).
 * - Mantener pulsado el clic `HOLD_MS` sobre el fondo (no sobre una tarjeta ni un control) y mover
 *   el ratón arrastra la vista. Arrastrar tarjetas y el trackpad siguen igual.
 * `step` = ancho de columna + hueco (px). Devuelve `panning` para pintar el estado.
 */
export function useBoardNav(ref: React.RefObject<HTMLElement | null>, step: number): { panning: boolean } {
  const [panning, setPanning] = useState(false)
  const hold = useRef<{ timer: number; x: number; y: number; left: number; top: number; id: number } | null>(null)
  // El estado actual para los listeners (sin volver a registrarlos).
  const panningRef = useRef(false)
  useEffect(() => {
    panningRef.current = panning
  }, [panning])

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = ref.current
      if (!el || isOverlayOpen() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (t instanceof HTMLElement && t.isContentEditable) return
      e.preventDefault()
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'
      if (e.shiftKey) el.scrollTo({ left: e.key === 'ArrowLeft' ? 0 : el.scrollWidth, behavior })
      else el.scrollBy({ left: e.key === 'ArrowLeft' ? -step : step, behavior })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref, step])

  // Pulsación larga + arrastrar la vista
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const cancel = (): void => {
      if (hold.current) window.clearTimeout(hold.current.timer)
      hold.current = null
    }
    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-card], button, a, input, textarea, select, [draggable="true"]')) return
      const id = e.pointerId
      hold.current = {
        x: e.clientX,
        y: e.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
        id,
        timer: window.setTimeout(() => {
          panningRef.current = true
          setPanning(true)
          try {
            el.setPointerCapture(id)
          } catch {
            // El puntero ya se soltó: no pasa nada.
          }
        }, HOLD_MS)
      }
    }
    const onMove = (e: PointerEvent): void => {
      const h = hold.current
      if (!h) return
      const dx = e.clientX - h.x
      const dy = e.clientY - h.y
      if (!panningRef.current) {
        if (Math.abs(dx) > SLOP_PX || Math.abs(dy) > SLOP_PX) cancel()
        return
      }
      e.preventDefault()
      el.scrollLeft = h.left - dx
      el.scrollTop = h.top - dy
    }
    const onUp = (e: PointerEvent): void => {
      if (panningRef.current) {
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          // Ya liberado.
        }
      }
      cancel()
      panningRef.current = false
      setPanning(false)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      cancel()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [ref])

  return { panning }
}
