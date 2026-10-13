import { useCallback, useEffect, useRef } from 'react'

/**
 * Temporizador de inactividad: mientras `active`, cada `poke()` reinicia la cuenta y, si pasan `ms`
 * sin otro `poke()`, llama `onIdle`. Sin `poke()` no corre (entrar a editar sin escribir no expulsa).
 */
export function useIdleExit(active: boolean, ms: number, onIdle: () => void): { poke: () => void } {
  const timer = useRef<number | null>(null)
  const latest = useRef(onIdle)

  useEffect(() => {
    latest.current = onIdle
  }, [onIdle])

  // Al dejar de estar activo (o al desmontar) se cancela la cuenta pendiente.
  useEffect(() => {
    if (!active && timer.current !== null) window.clearTimeout(timer.current)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [active])

  const poke = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      latest.current()
    }, ms)
  }, [ms])

  return { poke }
}
