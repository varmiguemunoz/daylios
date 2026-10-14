import { describe, expect, it } from 'vitest'
import { decodeHlc, encodeHlc, receive, tick, type Hlc } from '../shared/hlc'
import { applyMutation, visible, type Mutation, type RecordState } from '../shared/sync-merge'

const apply = (list: Mutation[], start: RecordState | null = null): RecordState | null =>
  list.reduce<RecordState | null>((s, m) => applyMutation(s, m), start)

const at = (ms: number, node: string, counter = 0): string => encodeHlc({ ms, counter, node })

const base: Mutation = {
  entity: 'clients',
  id: 'c1',
  op: 'upsert',
  fields: { name: 'Acme', sector: 'Construcción', status: 'active' },
  rev: at(1_000, 'a')
}

describe('reloj lógico híbrido', () => {
  it('se ordena como texto y sobrevive a un reloj atrasado', () => {
    let a: Hlc = { ms: 0, counter: 0, node: 'a' }
    a = tick(a, 5_000)
    const later = tick(a, 4_000)
    expect(later.ms).toBe(5_000)
    expect(encodeHlc(later) > encodeHlc(a)).toBe(true)
    expect(decodeHlc(encodeHlc(later))).toEqual(later)
  })

  it('al recibir queda por delante de los dos relojes', () => {
    const local: Hlc = { ms: 1_000, counter: 3, node: 'a' }
    const remote: Hlc = { ms: 1_000, counter: 7, node: 'b' }
    expect(receive(local, remote, 900)).toEqual({ ms: 1_000, counter: 8, node: 'a' })
  })

  it('rechaza un reloj remoto muy adelantado', () => {
    const local: Hlc = { ms: 0, counter: 0, node: 'a' }
    expect(() => receive(local, { ms: 10 * 60_000, counter: 0, node: 'b' }, 0)).toThrow()
  })
})

describe('dos dispositivos sin conexión', () => {
  it('campos distintos: se conservan los dos cambios en cualquier orden', () => {
    const fromA: Mutation = { ...base, fields: { name: 'Acme SAS' }, rev: at(2_000, 'a') }
    const fromB: Mutation = { ...base, fields: { sector: 'Energía' }, rev: at(1_500, 'b') }
    const one = visible(apply([base, fromA, fromB]))
    const two = visible(apply([base, fromB, fromA]))
    expect(one).toEqual({ name: 'Acme SAS', sector: 'Energía', status: 'active' })
    expect(two).toEqual(one)
  })

  it('el mismo campo: gana la revisión más reciente', () => {
    const fromA: Mutation = { ...base, fields: { status: 'paused' }, rev: at(2_000, 'a') }
    const fromB: Mutation = { ...base, fields: { status: 'closed' }, rev: at(2_000, 'b') }
    expect(visible(apply([base, fromA, fromB]))?.status).toBe('closed')
    expect(visible(apply([base, fromB, fromA]))?.status).toBe('closed')
  })

  it('borrar y editar antes: queda borrado; editar después lo recupera', () => {
    const del: Mutation = { ...base, op: 'delete', fields: {}, rev: at(3_000, 'b') }
    const before: Mutation = { ...base, fields: { name: 'Acme 2' }, rev: at(2_000, 'a') }
    const after: Mutation = { ...base, fields: { name: 'Acme 3' }, rev: at(4_000, 'a') }
    expect(visible(apply([base, before, del]))).toBeNull()
    expect(visible(apply([base, del, before]))).toBeNull()
    expect(visible(apply([base, del, after]))?.name).toBe('Acme 3')
  })

  it('aplicar dos veces el mismo cambio no cambia nada', () => {
    const fromA: Mutation = { ...base, fields: { name: 'Acme SAS' }, rev: at(2_000, 'a') }
    expect(apply([base, fromA, fromA])).toEqual(apply([base, fromA]))
  })
})
