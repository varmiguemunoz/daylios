import { describe, expect, it } from 'vitest'
import { edgeItems, nodeItems, paneItems } from '../renderer/src/consultora/workspace/board/menus'
import { createEditingStore } from '../renderer/src/consultora/workspace/board/context'
import type { MenuEntry } from '../renderer/src/ui'
import { normalizeUrl } from '../renderer/src/consultora/workspace/board/url'

const noop = (): void => undefined
const labels = (items: MenuEntry[]): string[] => items.flatMap((i) => (i ? [i.label] : []))

const pane = {
  canPaste: true,
  snapGrid: true,
  snapObjects: false,
  addCard: noop,
  addNote: noop,
  addMedia: noop,
  addLink: noop,
  addGroup: noop,
  paste: noop,
  toggleSnapGrid: noop,
  toggleSnapObjects: noop,
  toggleReadOnly: noop,
  fit: noop
}
const node = {
  count: 1,
  canEdit: true,
  canConvert: true,
  canGroup: true,
  zoom: noop,
  edit: noop,
  convert: noop,
  cut: noop,
  copy: noop,
  duplicate: noop,
  group: noop,
  remove: noop
}

describe('menús del board', () => {
  it('el fondo lista las opciones de Obsidian y marca los ajustes', () => {
    const items = paneItems({ ...pane, readOnly: false })
    expect(labels(items)).toEqual([
      'Añadir tarjeta',
      'Añadir nota de la bóveda',
      'Añadir imagen o archivo',
      'Añadir página web',
      'Crear grupo',
      'Pegar',
      'Ajustar a la rejilla',
      'Ajustar a objetos',
      'Solo lectura',
      'Encuadrar todo'
    ])
    const checked = Object.fromEntries(
      items.flatMap((i) => (i && i.checked !== undefined ? [[i.label, i.checked]] : []))
    )
    expect(checked).toEqual({
      'Ajustar a la rejilla': true,
      'Ajustar a objetos': false,
      'Solo lectura': false
    })
  })

  it('en solo lectura no se puede añadir ni pegar', () => {
    const shown = labels(paneItems({ ...pane, readOnly: true }))
    expect(shown).not.toContain('Añadir tarjeta')
    expect(shown).not.toContain('Pegar')
    expect(shown).toContain('Solo lectura')
  })

  it('la tarjeta ofrece editar y convertir solo cuando hay una', () => {
    expect(labels(nodeItems({ ...node, readOnly: false }))).toContain('Convertir en nota')
    const many = labels(nodeItems({ ...node, readOnly: false, count: 3 }))
    expect(many).not.toContain('Editar')
    expect(many).not.toContain('Convertir en nota')
    expect(labels(nodeItems({ ...node, readOnly: true }))).toEqual([
      'Encuadrar selección',
      'Abrir',
      'Copiar'
    ])
  })

  it('la conexión permite seguirla siempre', () => {
    expect(labels(edgeItems({ readOnly: true, label: noop, follow: noop, remove: noop }))).toEqual([
      'Seguir conexión'
    ])
    expect(labels(edgeItems({ readOnly: false, label: noop, follow: noop, remove: noop }))).toEqual(
      ['Editar rótulo', 'Seguir conexión', 'Borrar']
    )
  })
})

describe('edición en curso', () => {
  it('solo avisa cuando cambia el nodo en edición', () => {
    const store = createEditingStore()
    let calls = 0
    const stop = store.subscribe(() => calls++)
    store.set('a')
    store.set('a')
    store.set(null)
    stop()
    store.set('b')
    expect(calls).toBe(2)
    expect(store.get()).toBe('b')
  })
})

describe('dirección de página web', () => {
  it('acepta http y https y completa el esquema', () => {
    expect(normalizeUrl('jsoncanvas.org')).toBe('https://jsoncanvas.org/')
    expect(normalizeUrl(' http://a.com/x ')).toBe('http://a.com/x')
  })

  it('rechaza otros esquemas y texto vacío', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('file:///etc/passwd')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
  })
})
