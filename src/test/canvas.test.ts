import { describe, expect, it } from 'vitest'
import {
  applyBoardOps,
  canvasFileRefs,
  parseCanvas,
  rewriteCanvasFiles,
  serializeCanvas,
  summarizeCanvas
} from '../shared/canvas'

const OBSIDIAN = JSON.stringify({
  nodes: [
    { id: 'a', type: 'text', text: 'Hola', x: 0, y: 0, width: 250, height: 60, color: '1' },
    { id: 'b', type: 'file', file: 'Adjuntos/logo.png', x: 300, y: 0, width: 200, height: 200 },
    { id: 'g', type: 'group', label: 'Grupo', x: -20, y: -20, width: 600, height: 300, custom: 42 },
    { id: 'roto', type: 'text', x: 'no' }
  ],
  edges: [
    { id: 'e1', fromNode: 'a', toNode: 'b', toEnd: 'arrow' },
    { id: 'e2', fromNode: 'a', toNode: 'nadie' }
  ],
  extra: true
})

describe('JSON Canvas', () => {
  it('lee un archivo de Obsidian, descarta lo inválido y conserva campos desconocidos', () => {
    const c = parseCanvas(OBSIDIAN)
    expect(c.nodes.map((n) => n.id)).toEqual(['a', 'b', 'g'])
    expect(c.edges.map((e) => e.id)).toEqual(['e1'])
    expect(c.nodes[2].custom).toBe(42)
    expect(c.extra).toBe(true)
  })

  it('ida y vuelta sin pérdida', () => {
    const c = parseCanvas(OBSIDIAN)
    expect(parseCanvas(serializeCanvas(c))).toEqual(c)
  })

  it('vacío = canvas vacío; JSON roto lanza', () => {
    expect(parseCanvas('')).toEqual({ nodes: [], edges: [] })
    expect(() => parseCanvas('{nope')).toThrow()
  })

  it('referencias y reescritura de rutas de archivo', () => {
    const c = parseCanvas(OBSIDIAN)
    expect(canvasFileRefs(c)).toEqual(['Adjuntos/logo.png'])
    const next = rewriteCanvasFiles(c, new Map([['Adjuntos/logo.png', 'Marca/logo.png']]))
    expect(canvasFileRefs(next)).toEqual(['Marca/logo.png'])
    expect(rewriteCanvasFiles(c, new Map())).toBe(c)
  })
})

describe('operaciones sobre un board', () => {
  it('añade nodos y conexiones, edita y borra en cascada', () => {
    const { canvas, created } = applyBoardOps({ nodes: [], edges: [] }, [
      { op: 'add_node', kind: 'sticky', id: 'lead', text: 'Lead' },
      { op: 'add_node', kind: 'shape', id: 'cierre', text: 'Cierre', shape: 'diamond' },
      { op: 'add_edge', from: 'lead', to: 'cierre', label: 'llamada' },
      { op: 'update_node', id: 'lead', text: 'Lead frío', color: null }
    ])
    expect(created).toHaveLength(3)
    const summary = summarizeCanvas(canvas)
    expect(summary.nodes.map((n) => n.kind)).toEqual(['sticky', 'shape:diamond'])
    expect(summary.nodes[0].text).toBe('Lead frío')
    expect(summary.nodes[0].color).toBeUndefined()
    expect(summary.nodes[1].x).toBeGreaterThan(summary.nodes[0].x)
    expect(summary.edges[0]).toMatchObject({
      from: 'lead',
      to: 'cierre',
      label: 'llamada',
      arrow: 'end'
    })

    const after = applyBoardOps(canvas, [{ op: 'remove_node', id: 'lead' }]).canvas
    expect(after.nodes).toHaveLength(1)
    expect(after.edges).toHaveLength(0)
  })

  it('rechaza referencias que no existen', () => {
    expect(() =>
      applyBoardOps({ nodes: [], edges: [] }, [{ op: 'add_edge', from: 'a', to: 'b' }])
    ).toThrow()
    expect(() =>
      applyBoardOps({ nodes: [], edges: [] }, [{ op: 'add_node', kind: 'file' }])
    ).toThrow()
  })
})
