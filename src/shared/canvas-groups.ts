import type { CanvasNode } from './canvas'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function contains(group: Rect & { id?: string }, node: Rect & { id?: string }): boolean {
  if (group.id && group.id === node.id) return false
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    node.x + node.width <= group.x + group.width &&
    node.y + node.height <= group.y + group.height
  )
}

export function childrenOf(group: CanvasNode, nodes: CanvasNode[]): CanvasNode[] {
  return nodes.filter((n) => n.id !== group.id && contains(group, n))
}

export function groupAround(nodes: Rect[], padding = 40): Rect {
  const left = Math.min(...nodes.map((n) => n.x))
  const top = Math.min(...nodes.map((n) => n.y))
  const right = Math.max(...nodes.map((n) => n.x + n.width))
  const bottom = Math.max(...nodes.map((n) => n.y + n.height))
  return {
    x: Math.round(left - padding),
    y: Math.round(top - padding),
    width: Math.round(right - left + padding * 2),
    height: Math.round(bottom - top + padding * 2)
  }
}

export function groupZ(group: Rect): number {
  return -1 - Math.min(999, Math.round((group.width * group.height) / 10000))
}

export function sampleBoard(count: number): {
  nodes: CanvasNode[]
  edges: { id: string; fromNode: string; toNode: string }[]
} {
  const nodes: CanvasNode[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    type: 'text',
    text: `# Tarjeta ${i}\n\nTexto de ejemplo con **markdown** y una lista:\n\n- uno\n- dos`,
    x: (i % 25) * 300,
    y: Math.floor(i / 25) * 220,
    width: 260,
    height: 180,
    ...(i % 7 === 0 ? { color: String((i % 6) + 1) } : {})
  }))
  const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, fromNode: nodes[i].id, toNode: n.id }))
  return { nodes, edges }
}
