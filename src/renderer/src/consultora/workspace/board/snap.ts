import type { Rect } from '@shared/canvas-groups'

export type Axis = 'x' | 'y'

export interface Guide {
  axis: Axis
  at: number
  from: number
  to: number
}

export interface Snap {
  dx: number
  dy: number
  guides: Guide[]
}

export interface Point {
  x: number
  y: number
}

const lines = (r: Rect, axis: Axis): number[] =>
  axis === 'x' ? [r.x, r.x + r.width / 2, r.x + r.width] : [r.y, r.y + r.height / 2, r.y + r.height]

interface Match {
  delta: number
  at: number
  other: Rect
}

function closest(moving: Rect, others: Rect[], axis: Axis, threshold: number): Match | null {
  let found: Match | null = null
  for (const other of others) {
    for (const a of lines(moving, axis)) {
      for (const b of lines(other, axis)) {
        const delta = b - a
        if (Math.abs(delta) <= threshold && (!found || Math.abs(delta) < Math.abs(found.delta)))
          found = { delta, at: b, other }
      }
    }
  }
  return found
}

function guide(axis: Axis, match: Match, moved: Rect): Guide {
  const [start, size] = axis === 'x' ? (['y', 'height'] as const) : (['x', 'width'] as const)
  return {
    axis,
    at: match.at,
    from: Math.min(moved[start], match.other[start]),
    to: Math.max(moved[start] + moved[size], match.other[start] + match.other[size])
  }
}

export function snapToObjects(moving: Rect, others: Rect[], threshold: number): Snap {
  const x = closest(moving, others, 'x', threshold)
  const y = closest(moving, others, 'y', threshold)
  const moved = { ...moving, x: moving.x + (x?.delta ?? 0), y: moving.y + (y?.delta ?? 0) }
  const guides: Guide[] = []
  if (x) guides.push(guide('x', x, moved))
  if (y) guides.push(guide('y', y, moved))
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides }
}

export function boundsOf(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

export const lockAxis = (delta: Point): Point =>
  Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y }
