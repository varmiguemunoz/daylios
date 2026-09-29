import { useEffect, useRef, useState } from 'react'
import { DAILY_LIMIT } from '@shared/tasks'

interface MeterProps {
  done: number
  total: number
  size?: 'lg' | 'sm'
}

/**
 * El día como ocho segmentos.
 * menta = hecha · melocotón suave = pendiente · contorno = hueco libre.
 */
export function Meter({ done, total, size = 'lg' }: MeterProps): React.JSX.Element {
  const complete = done >= DAILY_LIMIT
  const prevDone = useRef(done)
  const [celebrate, setCelebrate] = useState(false)

  // El brillo solo ocurre en la transición a 8/8, no al abrir un día ya completo.
  useEffect(() => {
    if (complete && prevDone.current < DAILY_LIMIT) {
      setCelebrate(true)
      const t = window.setTimeout(() => setCelebrate(false), 1800)
      prevDone.current = done
      return () => window.clearTimeout(t)
    }
    prevDone.current = done
    return undefined
  }, [done, complete])

  const lg = size === 'lg'

  return (
    <div
      role="meter"
      aria-label="Progreso del día"
      aria-valuemin={0}
      aria-valuemax={DAILY_LIMIT}
      aria-valuenow={done}
      aria-valuetext={`${done} hechas de ${total} planificadas, techo ${DAILY_LIMIT}`}
      className={`relative flex overflow-hidden ${lg ? 'h-3 gap-1.5' : 'h-1.5 w-[92px] gap-[3px]'} ${
        celebrate ? 'meter-complete' : ''
      }`}
    >
      {Array.from({ length: DAILY_LIMIT }, (_, i) => {
        const isDone = i < done
        const isPlanned = i < total
        return (
          <span
            key={i}
            className={`relative flex-1 overflow-hidden rounded-full ${
              isPlanned
                ? 'bg-apricot-soft'
                : 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--color-hairline)]'
            }`}
          >
            <span
              className="seg-fill absolute inset-0 rounded-full bg-mint"
              style={{ transform: `scaleX(${isDone ? 1 : 0})` }}
            />
          </span>
        )
      })}
    </div>
  )
}
