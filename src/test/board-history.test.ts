import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  back,
  emptyHistory,
  forward,
  record
} from '../renderer/src/consultora/workspace/board/history'

describe('historial del board', () => {
  it('deshacer devuelve la instantánea anterior y guarda la actual para rehacer', () => {
    const h = record(record(emptyHistory<number>(), 1), 2)
    const undone = back(h, 3)
    expect(undone?.[1]).toBe(2)
    const redone = forward(undone![0], 2)
    expect(redone?.[1]).toBe(3)
    expect(redone?.[0].past).toEqual([1, 2])
  })

  it('sin pasado ni futuro no hace nada', () => {
    expect(back(emptyHistory<number>(), 1)).toBeNull()
    expect(forward(emptyHistory<number>(), 1)).toBeNull()
  })

  it('un cambio nuevo borra lo que se podía rehacer', () => {
    const [h] = back(record(emptyHistory<number>(), 1), 2)!
    expect(h.future).toEqual([2])
    expect(record(h, 5).future).toEqual([])
  })

  it('guarda como mucho el límite y descarta lo más viejo', () => {
    let h = emptyHistory<number>()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = record(h, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(5)
  })

  it('no muta la pila recibida', () => {
    const h = record(emptyHistory<number>(), 1)
    back(h, 2)
    expect(h.past).toEqual([1])
    expect(h.future).toEqual([])
  })
})
