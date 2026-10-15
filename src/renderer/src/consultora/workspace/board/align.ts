import type { Rect } from '@shared/canvas-groups'
import { boundsOf, type Axis, type Point } from './snap'

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

export type Placed = Rect & { id: string }

export function align(rects: Placed[], mode: AlignMode): Map<string, Point> {
  const out = new Map<string, Point>()
  if (rects.length < 2) return out
  const box = boundsOf(rects)
  for (const r of rects) {
    const x =
      mode === 'left'
        ? box.x
        : mode === 'right'
          ? box.x + box.width - r.width
          : mode === 'center'
            ? box.x + (box.width - r.width) / 2
            : r.x
    const y =
      mode === 'top'
        ? box.y
        : mode === 'bottom'
          ? box.y + box.height - r.height
          : mode === 'middle'
            ? box.y + (box.height - r.height) / 2
            : r.y
    if (x !== r.x || y !== r.y) out.set(r.id, { x: Math.round(x), y: Math.round(y) })
  }
  return out
}

export function distribute(rects: Placed[], axis: Axis): Map<string, Point> {
  const out = new Map<string, Point>()
  if (rects.length < 3) return out
  const size = axis === 'x' ? 'width' : 'height'
  const sorted = [...rects].sort((a, b) => a[axis] - b[axis])
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = last[axis] + last[size] - first[axis]
  const used = sorted.reduce((sum, r) => sum + r[size], 0)
  const gap = (span - used) / (sorted.length - 1)
  let cursor = first[axis]
  for (const r of sorted) {
    const at = Math.round(cursor)
    if (at !== r[axis]) out.set(r.id, axis === 'x' ? { x: at, y: r.y } : { x: r.x, y: at })
    cursor += r[size] + gap
  }
  return out
}
