import { useLayoutEffect } from 'react'
import { useStore } from '@xyflow/react'
import { LIVE_EDGES } from './viewport'

const LAYERS = '.react-flow__edges, .react-flow__edgelabel-renderer, .react-flow__viewport-portal'
const SETTLE_MS = 150

export function ZoomVar({ target }: { target: React.RefObject<HTMLElement | null> }): null {
  const zoom = useStore((s) => s.transform[2])
  const live = useStore((s) => s.edges.length <= LIVE_EDGES)
  useLayoutEffect(() => {
    const apply = (): void => {
      const value = String(1 / zoom)
      target.current?.querySelectorAll<HTMLElement>(LAYERS).forEach((el) => {
        el.style.setProperty('--ob-inv', value)
      })
    }
    if (live) return apply()
    const timer = setTimeout(apply, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [zoom, live, target])
  return null
}
