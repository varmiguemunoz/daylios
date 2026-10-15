import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  intersects,
  lockAxis,
  snapToObjects
} from '../renderer/src/consultora/workspace/board/snap'
import { align, distribute } from '../renderer/src/consultora/workspace/board/align'

const rect = (
  x: number,
  y: number,
  width = 100,
  height = 50
): { x: number; y: number; width: number; height: number } => ({ x, y, width, height })

describe('ajuste a objetos', () => {
  const other = rect(400, 300)

  it('alinea el borde izquierdo dentro del umbral y dibuja la guía', () => {
    const snap = snapToObjects(rect(406, 100), [other], 10)
    expect(snap.dx).toBe(-6)
    expect(snap.dy).toBe(0)
    expect(snap.guides).toEqual([{ axis: 'x', at: 400, from: 100, to: 350 }])
  })

  it('alinea centros y bordes en los dos ejes', () => {
    const snap = snapToObjects(rect(395, 297), [other], 10)
    expect([snap.dx, snap.dy]).toEqual([5, 3])
    expect(snap.guides.map((g) => g.axis)).toEqual(['x', 'y'])
  })

  it('elige la línea más cercana', () => {
    const snap = snapToObjects(rect(447, 0), [other], 10)
    expect(snap.dx).toBe(3)
  })

  it('fuera del umbral no mueve', () => {
    expect(snapToObjects(rect(420, 0), [other], 10)).toEqual({ dx: 0, dy: 0, guides: [] })
    expect(snapToObjects(rect(0, 0), [], 10)).toEqual({ dx: 0, dy: 0, guides: [] })
  })
})

describe('utilidades de arrastre', () => {
  it('fija el eje dominante', () => {
    expect(lockAxis({ x: 30, y: -10 })).toEqual({ x: 30, y: 0 })
    expect(lockAxis({ x: 3, y: -10 })).toEqual({ x: 0, y: -10 })
  })

  it('caja que envuelve y cruce de rectángulos', () => {
    expect(boundsOf([rect(0, 0), rect(200, 100)])).toEqual(rect(0, 0, 300, 150))
    expect(intersects(rect(0, 0), rect(50, 25))).toBe(true)
    expect(intersects(rect(0, 0), rect(100, 0))).toBe(false)
  })
})

describe('alinear y distribuir', () => {
  const a = { id: 'a', ...rect(0, 0, 100, 40) }
  const b = { id: 'b', ...rect(150, 70, 200, 80) }
  const c = { id: 'c', ...rect(500, 10, 100, 40) }

  it('alinea a la izquierda, al centro y abajo', () => {
    expect(align([a, b, c], 'left')).toEqual(
      new Map([
        ['b', { x: 0, y: 70 }],
        ['c', { x: 0, y: 10 }]
      ])
    )
    expect(align([a, b], 'center').get('a')).toEqual({ x: 125, y: 0 })
    expect(align([a, b], 'bottom').get('a')).toEqual({ x: 0, y: 110 })
  })

  it('con uno solo no hace nada', () => {
    expect(align([a], 'left').size).toBe(0)
  })

  it('distribuye con huecos iguales y deja fijos los extremos', () => {
    const moves = distribute([c, a, b], 'x')
    expect(moves.has('a')).toBe(false)
    expect(moves.has('c')).toBe(false)
    expect(moves.get('b')).toEqual({ x: 200, y: 70 })
  })

  it('con menos de tres no distribuye', () => {
    expect(distribute([a, b], 'y').size).toBe(0)
  })
})
