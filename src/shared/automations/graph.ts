import { MET_PORT, NEXT_PORT, nodeSpec, str } from './catalog'
import { ROOT, ROOT_SLOT, type Definition, type NodeDef, type Params, type Slot } from './model'

export type MoveMode = 'node' | 'subtree'

export interface Fragment {
  root: string
  nodes: Record<string, NodeDef>
}

export function portsOf(node: NodeDef): string[] {
  return nodeSpec(node.type)?.ports(node.params) ?? []
}

export function mainPort(node: NodeDef): string | null {
  const ports = portsOf(node)
  if (ports.length === 0) return null
  if (ports.includes(NEXT_PORT)) return NEXT_PORT
  if (ports.includes(MET_PORT)) return MET_PORT
  return ports[0]
}

export function sameSlot(a: Slot, b: Slot): boolean {
  return a.parent === b.parent && a.port === b.port
}

export function childAt(def: Definition, slot: Slot): string | null {
  if (slot.parent === ROOT) return def.root
  return def.nodes[slot.parent]?.next[slot.port] ?? null
}

function setAt(def: Definition, slot: Slot, id: string | null): Definition {
  if (slot.parent === ROOT) return { ...def, root: id }
  const parent = def.nodes[slot.parent]
  if (!parent) return def
  return {
    ...def,
    nodes: { ...def.nodes, [parent.id]: { ...parent, next: { ...parent.next, [slot.port]: id } } }
  }
}

function putNode(def: Definition, node: NodeDef): Definition {
  return { ...def, nodes: { ...def.nodes, [node.id]: node } }
}

function dropNodes(def: Definition, ids: string[]): Definition {
  if (ids.length === 0) return def
  const gone = new Set(ids)
  const nodes: Record<string, NodeDef> = {}
  for (const node of Object.values(def.nodes)) {
    if (gone.has(node.id)) continue
    const target = node.type === 'go_to' ? str(node.params, 'target') : ''
    nodes[node.id] =
      target && gone.has(target) ? { ...node, params: { ...node.params, target: '' } } : node
  }
  return { ...def, nodes, root: def.root && gone.has(def.root) ? null : def.root }
}

export function normalizeNext(node: NodeDef): NodeDef {
  const next: Record<string, string | null> = {}
  for (const port of portsOf(node)) next[port] = node.next?.[port] ?? null
  return { ...node, next }
}

export function parentSlot(def: Definition, id: string): Slot | null {
  if (def.root === id) return ROOT_SLOT
  for (const node of Object.values(def.nodes)) {
    for (const [port, child] of Object.entries(node.next))
      if (child === id) return { parent: node.id, port }
  }
  return null
}

export function subtree(def: Definition, id: string): string[] {
  const out: string[] = []
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length) {
    const current = stack.pop()!
    if (seen.has(current) || !def.nodes[current]) continue
    seen.add(current)
    out.push(current)
    for (const child of Object.values(def.nodes[current].next)) if (child) stack.push(child)
  }
  return out
}

export function reachable(def: Definition): Set<string> {
  return new Set(def.root ? subtree(def, def.root) : [])
}

export function pathTo(def: Definition, id: string): string[] {
  const path: string[] = []
  const seen = new Set<string>()
  let current: string | null = id
  while (current && !seen.has(current)) {
    seen.add(current)
    path.unshift(current)
    const slot = parentSlot(def, current)
    current = slot && slot.parent !== ROOT ? slot.parent : null
  }
  return path
}

export function upstream(def: Definition, id: string): string[] {
  return pathTo(def, id).slice(0, -1)
}

export function slots(def: Definition): Slot[] {
  const out: Slot[] = [ROOT_SLOT]
  for (const id of reachable(def)) {
    for (const port of portsOf(def.nodes[id])) out.push({ parent: id, port })
  }
  return out
}

export function slotExists(def: Definition, slot: Slot): boolean {
  if (slot.parent === ROOT) return slot.port === ROOT
  const node = def.nodes[slot.parent]
  return !!node && portsOf(node).includes(slot.port)
}

export function tailSlot(def: Definition, id: string): Slot | null {
  let current = id
  const seen = new Set<string>()
  while (!seen.has(current)) {
    seen.add(current)
    const node = def.nodes[current]
    const port = node ? mainPort(node) : null
    if (!port) return null
    const child = node.next[port]
    if (!child) return { parent: current, port }
    current = child
  }
  return null
}

const TERMINAL_IN_MIDDLE = 'Ese paso termina el camino; solo puede ir al final de una rama.'

export function canInsert(def: Definition, slot: Slot, node: NodeDef): string | null {
  if (!slotExists(def, slot)) return 'Ese hueco no existe.'
  if (childAt(def, slot) && !mainPort(normalizeNext(node))) return TERMINAL_IN_MIDDLE
  return null
}

export function insert(def: Definition, slot: Slot, node: NodeDef): Definition {
  const reason = canInsert(def, slot, node)
  if (reason) throw new Error(reason)
  const fresh = normalizeNext({ ...node, next: {} })
  const occupant = childAt(def, slot)
  const port = mainPort(fresh)
  const placed = occupant && port ? { ...fresh, next: { ...fresh.next, [port]: occupant } } : fresh
  return setAt(putNode(def, placed), slot, placed.id)
}

export function setParams(def: Definition, id: string, params: Params, name?: string): Definition {
  const node = def.nodes[id]
  if (!node) return def
  const updated = normalizeNext({ ...node, params, name: name ?? node.name })
  const before = { ...node.next }
  const oldMain = mainPort(node)
  const newMain = mainPort(updated)
  if (
    oldMain &&
    newMain &&
    !(oldMain in updated.next) &&
    before[oldMain] &&
    !updated.next[newMain]
  ) {
    updated.next[newMain] = before[oldMain]
    before[oldMain] = null
  }
  const lost = Object.entries(before)
    .filter(([port, child]) => child && !(port in updated.next))
    .flatMap(([, child]) => subtree(def, child as string))
  return dropNodes(putNode(def, updated), lost)
}

export function removeNode(def: Definition, id: string, keep?: string): Definition {
  const node = def.nodes[id]
  const slot = parentSlot(def, id)
  if (!node || !slot) return dropNodes(def, node ? [id] : [])
  const keepPort = keep !== undefined ? keep : mainPort(node)
  const kept = keepPort ? (node.next[keepPort] ?? null) : null
  const lost = Object.entries(node.next)
    .filter(([port, child]) => child && port !== keepPort)
    .flatMap(([, child]) => subtree(def, child as string))
  return dropNodes(setAt(def, slot, kept), [id, ...lost])
}

export function removeSubtree(def: Definition, id: string): Definition {
  const slot = parentSlot(def, id)
  const ids = subtree(def, id)
  return dropNodes(slot ? setAt(def, slot, null) : def, ids)
}

export function removeBranch(def: Definition, ifId: string, branchId: string): Definition {
  const node = def.nodes[ifId]
  if (!node || node.type !== 'if_else') return def
  const branches = Array.isArray(node.params.branches) ? node.params.branches : []
  const child = node.next[branchId]
  const cleared = child ? removeSubtree(def, child) : def
  return setParams(cleared, ifId, {
    ...node.params,
    branches: branches.filter((b: { id: string }) => b.id !== branchId)
  })
}

function effectiveMode(node: NodeDef, mode: MoveMode): MoveMode {
  return mode === 'node' && portsOf(node).length <= 1 ? 'node' : 'subtree'
}

function goToIssue(def: Definition): string | null {
  const live = reachable(def)
  for (const id of live) {
    const node = def.nodes[id]
    if (node.type !== 'go_to') continue
    const target = str(node.params, 'target')
    if (target && !upstream(def, id).includes(target))
      return 'Un «Ir a» quedaría apuntando a un paso que no está antes.'
  }
  return null
}

function attempt(def: Definition, id: string, slot: Slot, mode: MoveMode): Definition | string {
  const node = def.nodes[id]
  const from = node ? parentSlot(def, id) : null
  if (!node || !from) return 'Ese paso no existe.'
  if (!slotExists(def, slot)) return 'Ese hueco no existe.'
  if (sameSlot(from, slot)) return def
  const effective = effectiveMode(node, mode)
  if (effective === 'node') {
    if (slot.parent === id) return def
    const port = mainPort(node)
    const child = port ? node.next[port] : null
    let out = setAt(def, from, child)
    const detached = port ? { ...node, next: { ...node.next, [port]: null } } : node
    out = putNode(out, detached)
    const occupant = childAt(out, slot)
    if (occupant && !port) return TERMINAL_IN_MIDDLE
    out = putNode(
      out,
      port && occupant ? { ...detached, next: { ...detached.next, [port]: occupant } } : detached
    )
    return setAt(out, slot, id)
  }
  if (subtree(def, id).includes(slot.parent)) return 'No se puede mover un paso dentro de sí mismo.'
  let out = setAt(def, from, null)
  const occupant = childAt(out, slot)
  out = setAt(out, slot, id)
  if (!occupant) return out
  const end = tailSlot(out, id)
  if (!end) return TERMINAL_IN_MIDDLE
  return setAt(out, end, occupant)
}

export function canMove(def: Definition, id: string, slot: Slot, mode: MoveMode): string | null {
  const result = attempt(def, id, slot, mode)
  if (typeof result === 'string') return result
  return goToIssue(result)
}

export function move(def: Definition, id: string, slot: Slot, mode: MoveMode): Definition {
  const result = attempt(def, id, slot, mode)
  if (typeof result === 'string') throw new Error(result)
  const issue = goToIssue(result)
  if (issue) throw new Error(issue)
  return result
}

export function clone(
  def: Definition,
  id: string,
  mode: MoveMode,
  newId: () => string = uuid
): Fragment {
  const node = def.nodes[id]
  if (!node) throw new Error('Ese paso no existe.')
  const ids = effectiveMode(node, mode) === 'node' ? [id] : subtree(def, id)
  const map = new Map(ids.map((old) => [old, newId()]))
  const nodes: Record<string, NodeDef> = {}
  for (const old of ids) {
    const source = def.nodes[old]
    const next: Record<string, string | null> = {}
    for (const [port, child] of Object.entries(source.next))
      next[port] = child ? (map.get(child) ?? null) : null
    const target = source.type === 'go_to' ? str(source.params, 'target') : ''
    const params =
      target && map.has(target)
        ? { ...source.params, target: map.get(target) }
        : { ...source.params }
    nodes[map.get(old)!] = { ...source, id: map.get(old)!, next, params: structuredClone(params) }
  }
  return { root: map.get(id)!, nodes }
}

export function paste(def: Definition, slot: Slot, fragment: Fragment): Definition {
  if (!slotExists(def, slot)) throw new Error('Ese hueco no existe.')
  const occupant = childAt(def, slot)
  let out: Definition = { ...def, nodes: { ...def.nodes, ...fragment.nodes } }
  out = setAt(out, slot, fragment.root)
  if (!occupant) return out
  const end = tailSlot(out, fragment.root)
  if (!end) throw new Error(TERMINAL_IN_MIDDLE)
  return setAt(out, end, occupant)
}

export interface Edge {
  source: string
  target: string
  port: string
}

export function edges(def: Definition): Edge[] {
  const out: Edge[] = []
  for (const id of reachable(def)) {
    for (const [port, child] of Object.entries(def.nodes[id].next))
      if (child) out.push({ source: id, target: child, port })
  }
  return out
}

export const LAYOUT = { nodeWidth: 260, nodeHeight: 76, colGap: 48, rowGap: 80 }

export interface Point {
  x: number
  y: number
}

export interface Layout {
  triggers: Point[]
  addTrigger: Point
  nodes: Record<string, Point>
  slots: { slot: Slot; x: number; y: number }[]
  width: number
  height: number
}

export function layout(def: Definition, size = LAYOUT): Layout {
  const column = size.nodeWidth + size.colGap
  const row = size.nodeHeight + size.rowGap
  const widths = new Map<string, number>()
  const width = (id: string): number => {
    const cached = widths.get(id)
    if (cached !== undefined) return cached
    const node = def.nodes[id]
    const ports = node ? portsOf(node) : []
    let w = 1
    if (ports.length === 1) {
      const child = node.next[ports[0]]
      w = child ? width(child) : 1
    } else if (ports.length > 1) {
      w = ports.reduce((sum, p) => sum + (node.next[p] ? width(node.next[p] as string) : 1), 0)
    }
    widths.set(id, w)
    return w
  }

  const nodes: Record<string, Point> = {}
  const slotList: Layout['slots'] = []
  let deepest = 0
  const top = row

  const place = (id: string, left: number, depth: number, seen: Set<string>): void => {
    if (seen.has(id) || !def.nodes[id]) return
    seen.add(id)
    deepest = Math.max(deepest, depth)
    const node = def.nodes[id]
    const center = left + (width(id) * column) / 2
    const y = top + depth * row
    nodes[id] = { x: center - size.nodeWidth / 2, y }
    const ports = portsOf(node)
    const slotY = y + size.nodeHeight + size.rowGap / 2
    if (ports.length === 1) {
      slotList.push({ slot: { parent: id, port: ports[0] }, x: center, y: slotY })
      const child = node.next[ports[0]]
      if (child) place(child, left, depth + 1, seen)
      return
    }
    let cursor = left
    for (const port of ports) {
      const child = node.next[port]
      const w = child ? width(child) : 1
      slotList.push({ slot: { parent: id, port }, x: cursor + (w * column) / 2, y: slotY })
      if (child) place(child, cursor, depth + 1, seen)
      cursor += w * column
    }
  }

  const treeWidth = def.root ? width(def.root) : 1
  const cards = def.triggers.length + 1
  const totalColumns = Math.max(treeWidth, cards)
  const treeLeft = ((totalColumns - treeWidth) * column) / 2
  const center = treeLeft + (treeWidth * column) / 2
  slotList.push({ slot: ROOT_SLOT, x: center, y: top - size.rowGap / 2 })
  if (def.root) place(def.root, treeLeft, 0, new Set())

  const cardsLeft = center - (cards * column) / 2 + size.colGap / 2
  const triggers = def.triggers.map((_, i) => ({ x: cardsLeft + i * column, y: 0 }))
  const addTrigger = { x: cardsLeft + def.triggers.length * column, y: 0 }

  return {
    triggers,
    addTrigger,
    nodes,
    slots: slotList,
    width: totalColumns * column,
    height: top + (def.root ? deepest + 1 : 1) * row
  }
}

function uuid(): string {
  return globalThis.crypto.randomUUID()
}
