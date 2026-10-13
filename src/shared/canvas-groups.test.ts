import { describe, expect, it } from 'vitest'
import type { CanvasNode } from './canvas'
import { childrenOf, contains, groupAround, groupZ, sampleBoard } from './canvas-groups'
import { parseCanvas, serializeCanvas } from './canvas'

const node = (
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 100,
  type: CanvasNode['type'] = 'text'
): CanvasNode => ({
  id,
  type,
  x,
  y,
  width: w,
  height: h
})

describe('grupos del board', () => {
  const outer = node('g1', 0, 0, 1000, 1000, 'group')
  const inner = node('g2', 100, 100, 400, 400, 'group')
  const a = node('a', 150, 150)
  const b = node('b', 600, 600)
  const outside = node('c', 1200, 0)
  const crossing = node('d', 950, 950) // se sale por la esquina

  it('dentro = cabe entero', () => {
    expect(contains(outer, a)).toBe(true)
    expect(contains(outer, crossing)).toBe(false)
    expect(contains(outer, outer)).toBe(false)
  })

  it('el contenido incluye grupos anidados y lo de dentro de ellos', () => {
    const all = [outer, inner, a, b, outside, crossing]
    expect(
      childrenOf(outer, all)
        .map((n) => n.id)
        .sort()
    ).toEqual(['a', 'b', 'g2'])
    expect(childrenOf(inner, all).map((n) => n.id)).toEqual(['a'])
  })

  it('groupAround envuelve con margen; los anidados van delante', () => {
    expect(groupAround([a, b], 40)).toEqual({ x: 110, y: 110, width: 630, height: 630 })
    expect(groupZ(inner)).toBeGreaterThan(groupZ(outer))
    expect(groupZ(outer)).toBeLessThan(0)
  })

  it('un board de 500 tarjetas se serializa y se lee rápido', () => {
    const board = sampleBoard(500)
    const t0 = performance.now()
    const back = parseCanvas(serializeCanvas(board))
    expect(back.nodes).toHaveLength(500)
    expect(back.edges).toHaveLength(499)
    expect(performance.now() - t0).toBeLessThan(200)
  })
})
