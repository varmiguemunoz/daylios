import { describe, expect, it } from 'vitest'
import {
  canMove,
  childAt,
  clone,
  edges,
  emptyDefinition,
  insert,
  layout,
  move,
  paste,
  removeBranch,
  removeNode,
  removeSubtree,
  ROOT_SLOT,
  setParams,
  upstream,
  validateDefinition,
  type Definition,
  type NodeDef
} from '@shared/automations'

const node = (
  id: string,
  type: NodeDef['type'] = 'add_tag',
  params: NodeDef['params'] = { tag: 'x' }
): NodeDef => ({
  id,
  type,
  name: id,
  params,
  next: {}
})

const branches = (...ids: string[]): NodeDef['params'] => ({
  branches: ids.map((id) => ({
    id,
    name: id,
    groups: [
      { join: 'and', conditions: [{ field: 'contact.tags', operator: 'includes', value: id }] }
    ]
  }))
})

const chain = (...ids: string[]): Definition => {
  let def: Definition = {
    ...emptyDefinition('contact'),
    triggers: [{ id: 't1', type: 'contact.created', params: {}, conditions: [] }]
  }
  let slot = ROOT_SLOT
  for (const id of ids) {
    def = insert(def, slot, node(id))
    slot = { parent: id, port: 'next' }
  }
  return def
}

const order = (def: Definition): string[] => {
  const out: string[] = []
  let current = def.root
  while (current) {
    out.push(current)
    current = def.nodes[current].next.next ?? null
  }
  return out
}

describe('insertar y borrar', () => {
  it('insertar en medio empuja lo que había debajo', () => {
    const def = insert(chain('a', 'c'), { parent: 'a', port: 'next' }, node('b'))
    expect(order(def)).toEqual(['a', 'b', 'c'])
  })

  it('un paso terminal no entra en medio de un camino', () => {
    expect(() =>
      insert(chain('a', 'b'), { parent: 'a', port: 'next' }, node('f', 'finish', {}))
    ).toThrow()
    expect(() =>
      insert(chain('a'), { parent: 'a', port: 'next' }, node('f', 'finish', {}))
    ).not.toThrow()
  })

  it('un If/Else insertado en medio lleva el resto a su primera rama', () => {
    const def = insert(
      chain('a', 'b'),
      { parent: 'a', port: 'next' },
      node('if', 'if_else', branches('x', 'y'))
    )
    expect(def.nodes.if.next).toEqual({ x: 'b', y: null, none: null })
  })

  it('borrar un nodo reconecta a su hijo', () => {
    expect(order(removeNode(chain('a', 'b', 'c'), 'b'))).toEqual(['a', 'c'])
  })

  it('borrar un If/Else conserva la rama elegida y borra las demás', () => {
    let def = insert(
      chain('a'),
      { parent: 'a', port: 'next' },
      node('if', 'if_else', branches('x', 'y'))
    )
    def = insert(def, { parent: 'if', port: 'x' }, node('bx'))
    def = insert(def, { parent: 'if', port: 'y' }, node('by'))
    const kept = removeNode(def, 'if', 'y')
    expect(order(kept)).toEqual(['a', 'by'])
    expect(kept.nodes.bx).toBeUndefined()
  })

  it('borrar una rama borra su subárbol', () => {
    let def = insert(
      chain('a'),
      { parent: 'a', port: 'next' },
      node('if', 'if_else', branches('x', 'y'))
    )
    def = insert(def, { parent: 'if', port: 'x' }, node('bx'))
    def = removeBranch(def, 'if', 'x')
    expect(def.nodes.bx).toBeUndefined()
    expect(Object.keys(def.nodes.if.next)).toEqual(['y', 'none'])
  })

  it('borrar un subárbol limpia los «Ir a» que apuntaban dentro', () => {
    let def = chain('a', 'b')
    def = insert(def, { parent: 'b', port: 'next' }, node('g', 'go_to', { target: 'b' }))
    def = removeSubtree(def, 'b')
    expect(def.nodes.g).toBeUndefined()
    expect(order(def)).toEqual(['a'])
  })

  it('cambiar la espera a condición conserva el camino en «se cumplió»', () => {
    let def = insert(
      chain('a', 'b'),
      { parent: 'a', port: 'next' },
      node('w', 'wait', { mode: 'delay', amount: 1, unit: 'days' })
    )
    def = setParams(def, 'w', {
      mode: 'condition',
      timeout: 1,
      timeoutUnit: 'days',
      conditions: []
    })
    expect(def.nodes.w.next).toEqual({ met: 'b', timeout: null })
  })
})

describe('arrastrar y soltar', () => {
  it('mueve un nodo solo y su hijo sube a su lugar', () => {
    const def = move(chain('a', 'b', 'c', 'd'), 'b', { parent: 'c', port: 'next' }, 'node')
    expect(order(def)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('mueve un subárbol completo al final', () => {
    const def = move(chain('a', 'b', 'c', 'd'), 'b', { parent: 'a', port: 'next' }, 'subtree')
    expect(order(def)).toEqual(['a', 'b', 'c', 'd'])
    const start = move(chain('a', 'b', 'c'), 'b', ROOT_SLOT, 'subtree')
    expect(order(start)).toEqual(['b', 'c', 'a'])
  })

  it('no deja mover un subárbol dentro de sí mismo', () => {
    const def = chain('a', 'b', 'c')
    expect(canMove(def, 'a', { parent: 'c', port: 'next' }, 'subtree')).toBe(
      'No se puede mover un paso dentro de sí mismo.'
    )
    expect(canMove(def, 'a', { parent: 'c', port: 'next' }, 'node')).toBeNull()
  })

  it('un If/Else siempre se mueve con sus ramas', () => {
    let def = insert(
      chain('a', 'b'),
      { parent: 'b', port: 'next' },
      node('if', 'if_else', branches('x'))
    )
    def = insert(def, { parent: 'if', port: 'x' }, node('bx'))
    def = move(def, 'if', ROOT_SLOT, 'node')
    expect(def.root).toBe('if')
    expect(def.nodes.if.next.x).toBe('bx')
    expect(def.nodes.bx.next.next).toBe('a')
    expect(childAt(def, { parent: 'a', port: 'next' })).toBe('b')
    expect(childAt(def, { parent: 'b', port: 'next' })).toBeNull()
    expect(validateDefinition(def).filter((i) => i.message.includes('conectado'))).toHaveLength(0)
  })

  it('no deja que un «Ir a» quede apuntando hacia abajo', () => {
    let def = chain('a', 'b', 'c')
    def = insert(def, { parent: 'c', port: 'next' }, node('g', 'go_to', { target: 'b' }))
    expect(canMove(def, 'g', { parent: 'a', port: 'next' }, 'node')).toBe(
      'Ese paso termina el camino; solo puede ir al final de una rama.'
    )
    expect(canMove(def, 'b', { parent: 'g', port: 'next' }, 'node')).toBe('Ese hueco no existe.')
    const moved = canMove(def, 'b', { parent: 'c', port: 'next' }, 'subtree')
    expect(moved).not.toBeNull()
  })

  it('soltar en el mismo hueco no cambia nada', () => {
    const def = chain('a', 'b')
    expect(move(def, 'b', { parent: 'a', port: 'next' }, 'node')).toBe(def)
  })
})

describe('copiar y pegar', () => {
  it('copia un subárbol con ids nuevos y remapea «Ir a» internos', () => {
    let def = chain('a', 'b')
    def = insert(def, { parent: 'b', port: 'next' }, node('g', 'go_to', { target: 'b' }))
    let n = 0
    const fragment = clone(def, 'b', 'subtree', () => `copy${++n}`)
    expect(Object.keys(fragment.nodes)).toHaveLength(2)
    const copiedGoTo = Object.values(fragment.nodes).find((x) => x.type === 'go_to')!
    expect(copiedGoTo.params.target).toBe(fragment.root)
    const pasted = paste(chain('z'), { parent: 'z', port: 'next' }, fragment)
    expect(upstream(pasted, copiedGoTo.id)).toContain(fragment.root)
  })
})

describe('layout', () => {
  it('reparte las ramas sin solaparse y centra el árbol', () => {
    let def = insert(
      chain('a'),
      { parent: 'a', port: 'next' },
      node('if', 'if_else', branches('x', 'y'))
    )
    def = insert(def, { parent: 'if', port: 'x' }, node('bx'))
    const result = layout(def)
    expect(result.nodes.a.x).toBe(result.nodes.if.x)
    expect(result.nodes.bx.y).toBeGreaterThan(result.nodes.if.y)
    const xs = result.slots.filter((s) => s.slot.parent === 'if').map((s) => s.x)
    expect(new Set(xs).size).toBe(3)
    expect(edges(def)).toHaveLength(2)
  })
})
