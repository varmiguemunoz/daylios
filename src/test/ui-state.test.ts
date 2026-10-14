import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  parseUiState,
  serializeUiState,
  trimValues,
  UI_STATE_VERSION
} from '../shared/ui-state'

describe('ui-state', () => {
  it('archivo dañado o de otra versión empieza vacío', () => {
    expect(parseUiState(null)).toEqual({})
    expect(parseUiState('{no es json')).toEqual({})
    expect(parseUiState(JSON.stringify({ version: 99, values: { a: 1 } }))).toEqual({})
    expect(parseUiState(JSON.stringify({ version: UI_STATE_VERSION, values: [1] }))).toEqual({})
  })

  it('lee lo que escribe', () => {
    const values = { 'menubar.screen': { name: 'notes' }, 'capture.draft': 'Llamar a' }
    expect(parseUiState(serializeUiState(values))).toEqual(values)
  })

  it('null borra y la clave tocada pasa al final', () => {
    const next = applyPatch({ a: 1, b: 2, c: 3 }, { a: 9, b: null })
    expect(next).toEqual({ c: 3, a: 9 })
    expect(Object.keys(next)).toEqual(['c', 'a'])
  })

  it('ignora claves vacías o demasiado largas', () => {
    expect(applyPatch({}, { '': 1, ['x'.repeat(300)]: 2 })).toEqual({})
  })

  it('recorta el scroll a los más recientes y no toca el resto', () => {
    const values: Record<string, unknown> = { 'menubar.screen': 'today' }
    for (let i = 0; i < 10; i++) values[`scroll.client:${i}`] = i
    const next = trimValues(values, 3)
    expect(Object.keys(next)).toEqual([
      'menubar.screen',
      'scroll.client:7',
      'scroll.client:8',
      'scroll.client:9'
    ])
  })

  it('respeta el tamaño máximo quitando primero lo recortable', () => {
    const values = { keep: 'x', 'scroll.a': 'y'.repeat(100), 'scroll.b': 'z'.repeat(100) }
    const next = trimValues(values, 500, 160)
    expect(next.keep).toBe('x')
    expect(next['scroll.a']).toBeUndefined()
  })
})
