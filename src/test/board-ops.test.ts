import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../shared/canvas'
import { toFlow } from '../renderer/src/consultora/workspace/board/flow'
import {
  carry,
  copySelection,
  moveTo,
  passengers,
  pasteClip,
  restack,
  withChildren
} from '../renderer/src/consultora/workspace/board/ops'

const node = (id: string, x: number, y: number, extra: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  type: 'text',
  x,
  y,
  width: 100,
  height: 60,
  ...extra
})

const board = (): ReturnType<typeof toFlow> =>
  toFlow({
    nodes: [
      node('g', 0, 0, { type: 'group', width: 500, height: 400 }),
      node('a', 50, 50),
      node('b', 200, 200),
      node('c', 800, 0)
    ],
    edges: [
      { id: 'e1', fromNode: 'a', toNode: 'b' },
      { id: 'e2', fromNode: 'b', toNode: 'c' }
    ]
  })

describe('grupos al mover', () => {
  it('seleccionar el grupo incluye lo que tiene dentro', () => {
    expect([...withChildren(board().nodes, new Set(['g']))].sort()).toEqual(['a', 'b', 'g'])
    expect([...withChildren(board().nodes, new Set(['c']))]).toEqual(['c'])
  })

  it('los pasajeros son los hijos no arrastrados con su posición inicial', () => {
    const riders = passengers(board().nodes, new Set(['g', 'a']))
    expect([...riders.keys()]).toEqual(['b'])
    expect(riders.get('b')).toEqual({ x: 200, y: 200 })
  })

  it('carry mueve los pasajeros con el mismo desplazamiento', () => {
    const { nodes } = board()
    const moved = carry(nodes, new Map([['b', { x: 200, y: 200 }]]), { x: 15, y: -5 })
    expect(moved.find((n) => n.id === 'b')?.position).toEqual({ x: 215, y: 195 })
    expect(moved.find((n) => n.id === 'a')).toBe(nodes.find((n) => n.id === 'a'))
    expect(carry(nodes, new Map(), { x: 1, y: 1 })).toBe(nodes)
  })

  it('restack recalcula el z de los grupos', () => {
    const nodes = board().nodes.map((n) => ({ ...n, zIndex: 0 }))
    const out = restack(nodes)
    expect(out[0].zIndex).toBeLessThan(0)
    expect(out[1]).toBe(nodes[1])
  })
})

describe('portapapeles', () => {
  it('copia la selección con sus hijos y solo las conexiones internas', () => {
    const { nodes, edges } = board()
    const sel = nodes.map((n) => ({ ...n, selected: n.id === 'g' }))
    const clip = copySelection(sel, edges)!
    expect(clip.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'g'])
    expect(clip.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('sin selección no copia nada', () => {
    const { nodes, edges } = board()
    expect(copySelection(nodes, edges)).toBeNull()
  })

  it('pegar crea ids nuevos, desplaza y reconecta', () => {
    const { nodes, edges } = board()
    const clip = copySelection(
      nodes.map((n) => ({ ...n, selected: n.id === 'a' || n.id === 'b' })),
      edges
    )!
    const pasted = pasteClip(clip, { x: 40, y: 40 })
    const ids = pasted.nodes.map((n) => n.id)
    expect(ids).not.toContain('a')
    expect(new Set(ids).size).toBe(2)
    expect(pasted.nodes.every((n) => n.selected)).toBe(true)
    expect(pasted.nodes[0].position).toEqual({ x: 90, y: 90 })
    expect(pasted.edges).toHaveLength(1)
    expect(ids).toContain(pasted.edges[0].source)
    expect(ids).toContain(pasted.edges[0].target)
  })
})

describe('mover a posiciones', () => {
  it('mover un grupo lleva su contenido', () => {
    const { nodes } = board()
    const out = moveTo(nodes, new Map([['g', { x: 100, y: 0 }]]))
    expect(out.find((n) => n.id === 'a')?.position).toEqual({ x: 150, y: 50 })
    expect(out.find((n) => n.id === 'c')?.position).toEqual({ x: 800, y: 0 })
  })

  it('un hijo con destino propio no se desplaza dos veces', () => {
    const { nodes } = board()
    const out = moveTo(
      nodes,
      new Map([
        ['g', { x: 100, y: 0 }],
        ['a', { x: 0, y: 0 }]
      ])
    )
    expect(out.find((n) => n.id === 'a')?.position).toEqual({ x: 0, y: 0 })
  })
})
