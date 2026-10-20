import { describe, expect, it } from 'vitest'
import { planBoardOps, type BoardOp, type CanvasNode } from '../shared/canvas'
import { diagramOps } from '../mcp/tools/workspace'

const overlaps = (a: CanvasNode, b: CanvasNode): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const noOverlap = (nodes: CanvasNode[]): boolean =>
  nodes.every((a, i) => nodes.slice(i + 1).every((b) => !overlaps(a, b)))

const flow = (n: number): BoardOp[] => [
  ...Array.from({ length: n }, (_, i) => ({
    op: 'add_node' as const,
    kind: 'shape' as const,
    id: `n${i}`,
    text: `Paso ${i}`
  })),
  ...Array.from({ length: n - 1 }, (_, i) => ({
    op: 'add_edge' as const,
    from: `n${Math.floor(i / 2)}`,
    to: `n${i + 1}`
  }))
]

describe('board: validación y acomodo', () => {
  it('junta todos los errores con su número y no aplica nada', () => {
    const result = planBoardOps({ nodes: [], edges: [] }, [
      { op: 'add_node', kind: 'shape', id: 'a' },
      { op: 'add_edge', from: 'a', to: 'x' },
      { op: 'add_node', kind: 'file' },
      { op: 'remove_edge', id: 'nada' }
    ])
    expect(result.errors.map((e) => e.index)).toEqual([1, 2, 3])
    expect(result.errors[0].message).toMatch(/«x»/)
  })

  it('flow-down coloca por capas hacia abajo, sin solapes y con lados de conexión', () => {
    const { canvas, errors } = planBoardOps({ nodes: [], edges: [] }, flow(15), {
      layout: 'flow-down'
    })
    expect(errors).toEqual([])
    const byId = new Map(canvas.nodes.map((n) => [n.id, n]))
    expect(byId.get('n1')!.y).toBeGreaterThan(byId.get('n0')!.y)
    expect(byId.get('n3')!.y).toBeGreaterThan(byId.get('n1')!.y)
    expect(noOverlap(canvas.nodes)).toBe(true)
    expect(canvas.edges.every((e) => e.fromSide === 'bottom' && e.toSide === 'top')).toBe(true)
  })

  it('flow-right avanza hacia la derecha y grid arma una cuadrícula', () => {
    const right = planBoardOps({ nodes: [], edges: [] }, flow(7), { layout: 'flow-right' }).canvas
    const byId = new Map(right.nodes.map((n) => [n.id, n]))
    expect(byId.get('n1')!.x).toBeGreaterThan(byId.get('n0')!.x)
    expect(noOverlap(right.nodes)).toBe(true)
    const grid = planBoardOps({ nodes: [], edges: [] }, flow(9), { layout: 'grid' }).canvas
    expect(new Set(grid.nodes.map((n) => n.y)).size).toBe(3)
    expect(noOverlap(grid.nodes)).toBe(true)
  })

  it('no pisa lo que ya había y respeta posiciones explícitas', () => {
    const existing = planBoardOps({ nodes: [], edges: [] }, [
      { op: 'add_node', kind: 'sticky', id: 'old', x: 0, y: 0 }
    ]).canvas
    const { canvas } = planBoardOps(
      existing,
      [...flow(5), { op: 'add_node', kind: 'text', id: 'fijo', x: -500, y: -500 }],
      { layout: 'tree' }
    )
    const old = canvas.nodes.find((n) => n.id === 'old')!
    expect(canvas.nodes.filter((n) => n.id !== 'old').every((n) => !overlaps(n, old))).toBe(true)
    expect(canvas.nodes.find((n) => n.id === 'fijo')).toMatchObject({ x: -500, y: -500 })
  })

  it('un diagrama de 150 nodos y 149 conexiones se arma en menos de 3 segundos', () => {
    const nodes = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, text: `Paso ${i}` }))
    const edges = nodes.slice(1).map((n, i) => ({ from: `s${Math.floor(i / 3)}`, to: n.id }))
    const started = Date.now()
    const { canvas, errors } = planBoardOps(
      { nodes: [], edges: [] },
      diagramOps(nodes, edges) as BoardOp[],
      { layout: 'flow-down' }
    )
    expect(Date.now() - started).toBeLessThan(3000)
    expect(errors).toEqual([])
    expect(canvas.nodes).toHaveLength(150)
    expect(canvas.edges).toHaveLength(149)
    expect(noOverlap(canvas.nodes)).toBe(true)
  })
})
