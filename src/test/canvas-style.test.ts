import { describe, expect, it } from 'vitest'
import { nextLineHeight, normalizeStyle, stepSize, toggleWrap } from '../shared/canvas-style'
import { applyBoardOps, parseCanvas, serializeCanvas, withStyle } from '../shared/canvas'

describe('estilo de texto de las tarjetas', () => {
  it('guarda solo valores válidos y distintos del defecto', () => {
    expect(normalizeStyle({ font: 'serif', size: 20, align: 'center', lineHeight: 2 })).toEqual({
      font: 'serif',
      size: 20,
      align: 'center',
      lineHeight: 2
    })
    expect(
      normalizeStyle({ font: 'comic', size: 17, align: 'justify', lineHeight: 9 })
    ).toBeUndefined()
    expect(
      normalizeStyle({ font: 'sans', size: 16, align: 'left', lineHeight: 1.5 })
    ).toBeUndefined()
    expect(normalizeStyle('x')).toBeUndefined()
  })

  it('el tamaño avanza por la escala y se detiene en los extremos', () => {
    expect(stepSize(undefined, 1)).toBe(20)
    expect(stepSize(16, -1)).toBe(14)
    expect(stepSize(40, 1)).toBe(40)
    expect(stepSize(12, -1)).toBe(12)
    expect(stepSize(17, 1)).toBe(20)
  })

  it('el interlineado rota', () => {
    expect(nextLineHeight(undefined)).toBe(2)
    expect(nextLineHeight(2)).toBe(1.2)
  })

  it('combina con la meta de DayliOS sin perder el tipo', () => {
    expect(withStyle({ kind: 'shape', shape: 'ellipse' }, { size: 24 })).toEqual({
      kind: 'shape',
      shape: 'ellipse',
      style: { size: 24 }
    })
    expect(withStyle({ kind: 'text', style: { size: 24 } }, undefined)).toEqual({ kind: 'text' })
    expect(withStyle(undefined, { size: 16 })).toBeUndefined()
  })
})

describe('negrita y cursiva en markdown', () => {
  it('envuelve la selección', () => {
    expect(toggleWrap('hola mundo', 5, 10, '**')).toEqual({
      text: 'hola **mundo**',
      start: 7,
      end: 12
    })
  })

  it('quita el marcador si ya está alrededor o dentro', () => {
    expect(toggleWrap('hola **mundo**', 7, 12, '**')).toEqual({
      text: 'hola mundo',
      start: 5,
      end: 10
    })
    expect(toggleWrap('hola *mundo*', 5, 12, '*')).toEqual({
      text: 'hola mundo',
      start: 5,
      end: 10
    })
  })

  it('sin selección deja el cursor entre los marcadores', () => {
    expect(toggleWrap('ab', 1, 1, '*')).toEqual({ text: 'a**b', start: 2, end: 2 })
  })
})

describe('compatibilidad del estilo con el archivo', () => {
  const json = JSON.stringify({
    nodes: [
      {
        id: 'a',
        type: 'text',
        text: '**hola**',
        x: 0,
        y: 0,
        width: 250,
        height: 60,
        daylios: { style: { size: 24, align: 'center', font: 'nope' } }
      },
      {
        id: 'b',
        type: 'text',
        text: 'x',
        x: 0,
        y: 100,
        width: 250,
        height: 60,
        daylios: { kind: 'shape', shape: 'rect', style: { size: 99 } }
      }
    ],
    edges: []
  })

  it('al leer limpia estilos inválidos y conserva los válidos', () => {
    const canvas = parseCanvas(json)
    expect(canvas.nodes[0].daylios).toEqual({ style: { size: 24, align: 'center' } })
    expect(canvas.nodes[1].daylios).toEqual({ kind: 'shape', shape: 'rect' })
    expect(parseCanvas(serializeCanvas(canvas))).toEqual(canvas)
  })

  it('las operaciones del MCP conservan el estilo', () => {
    const canvas = parseCanvas(
      JSON.stringify({
        nodes: [
          {
            id: 's',
            type: 'text',
            text: '',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            daylios: { kind: 'shape', shape: 'rect', style: { size: 24 } }
          }
        ],
        edges: []
      })
    )
    const { canvas: out } = applyBoardOps(canvas, [
      { op: 'update_node', id: 's', text: 'nuevo', shape: 'ellipse' }
    ])
    expect(out.nodes[0].daylios).toEqual({ kind: 'shape', shape: 'ellipse', style: { size: 24 } })
    expect(out.nodes[0].text).toBe('nuevo')
  })
})
