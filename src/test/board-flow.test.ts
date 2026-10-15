import { describe, expect, it } from 'vitest'
import type { CanvasFile, CanvasNode } from '../shared/canvas'
import { groupZ } from '../shared/canvas-groups'
import {
  ARROW,
  canvasOf,
  colorValue,
  flowKind,
  fromFlow,
  toFlow,
  toFlowNode
} from '../renderer/src/consultora/workspace/board/flow'

const node = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...extra
})

describe('tipos de nodo del board', () => {
  it.each([
    [node('a', { type: 'group' }), 'group'],
    [node('a', { type: 'link', url: 'https://x.com' }), 'link'],
    [node('a', { type: 'file', file: 'img/foto.png' }), 'image'],
    [node('a', { type: 'file', file: 'Notas/A.md' }), 'note'],
    [node('a', { type: 'file', file: 'doc.pdf' }), 'pdf'],
    [node('a', { type: 'file', file: 'hoja.xlsx' }), 'file'],
    [node('a'), 'card'],
    [node('a', { daylios: { kind: 'text' } }), 'text'],
    [node('a', { daylios: { kind: 'shape', shape: 'ellipse' } }), 'shape']
  ])('%#', (n, kind) => expect(flowKind(n)).toBe(kind))

  it('los grupos van detrás según su área', () => {
    const g = node('g', { type: 'group', width: 1000, height: 1000 })
    expect(toFlowNode(g).zIndex).toBe(groupZ(g))
    expect(toFlowNode(node('a')).zIndex).toBe(0)
  })
})

describe('colores', () => {
  it('preset, hex y valores inválidos', () => {
    expect(colorValue('1')).toBe('#fb464c')
    expect(colorValue('#abc')).toBe('#abc')
    expect(colorValue('rojo')).toBeNull()
    expect(colorValue(undefined)).toBeNull()
  })
})

describe('ida y vuelta JSON Canvas', () => {
  const canvas: CanvasFile = {
    nodes: [
      node('a', { x: 0, y: 0, color: '2', foo: 'extra' }),
      node('b', { x: 400, y: 10, type: 'file', file: 'Notas/A.md', subpath: '#Intro' }),
      node('c', { x: 0, y: 300 }),
      node('g', {
        type: 'group',
        x: -50,
        y: -50,
        width: 600,
        height: 500,
        background: 'f.png',
        backgroundStyle: 'cover'
      })
    ],
    edges: [
      { id: 'e1', fromNode: 'a', toNode: 'b', label: 'sigue' },
      { id: 'e2', fromNode: 'a', toNode: 'c', fromEnd: 'arrow', toEnd: 'none', color: '4' }
    ],
    meta: { autor: 'x' }
  }

  it('conserva campos que DayliOS no pinta y el orden de los nodos', () => {
    const { nodes, edges } = toFlow(canvas)
    const back = fromFlow(nodes, edges, canvas)
    expect(back.meta).toEqual({ autor: 'x' })
    expect(back.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'g'])
    expect(back.nodes[0].foo).toBe('extra')
    expect(back.nodes[1].subpath).toBe('#Intro')
    expect(back.nodes[3]).toMatchObject({ background: 'f.png', backgroundStyle: 'cover' })
    expect(back.edges[1].color).toBe('4')
  })

  it('elige lados por posición cuando el archivo no los trae', () => {
    const { edges } = toFlow(canvas)
    expect([edges[0].sourceHandle, edges[0].targetHandle]).toEqual(['right', 'left'])
    expect([edges[1].sourceHandle, edges[1].targetHandle]).toEqual(['bottom', 'top'])
  })

  it('respeta los extremos de flecha y los escribe explícitos', () => {
    const { nodes, edges } = toFlow(canvas)
    expect(edges[0].markerEnd).toEqual(ARROW)
    expect(edges[1].markerStart).toEqual(ARROW)
    expect(edges[1].markerEnd).toBeUndefined()
    const back = fromFlow(nodes, edges, canvas)
    expect(back.edges[0]).toMatchObject({ fromEnd: 'none', toEnd: 'arrow', label: 'sigue' })
    expect(back.edges[1]).toMatchObject({ fromEnd: 'arrow', toEnd: 'none' })
  })

  it('quita la etiqueta vacía', () => {
    const { nodes, edges } = toFlow(canvas)
    const back = fromFlow(nodes, [{ ...edges[0], label: '' }], canvas)
    expect(back.edges[0].label).toBeUndefined()
  })

  it('redondea posición y usa la medida si falta el tamaño', () => {
    const [n] = toFlow(canvas).nodes
    const moved = canvasOf({
      ...n,
      position: { x: 10.6, y: -3.2 },
      width: undefined,
      height: undefined,
      measured: { width: 120.4, height: 80.6 }
    })
    expect(moved).toMatchObject({ x: 11, y: -3, width: 120, height: 81 })
  })
})
