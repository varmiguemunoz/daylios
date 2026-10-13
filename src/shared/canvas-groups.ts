import type { CanvasNode } from './canvas'

/**
 * Grupos de un board, como en Obsidian: un elemento está «dentro» de un grupo si cabe entero en su
 * rectángulo. No hay relación guardada; JSON Canvas sigue plano.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** `node` cabe entero en `group` (y no es el mismo). */
export function contains(group: Rect & { id?: string }, node: Rect & { id?: string }): boolean {
  if (group.id && group.id === node.id) return false
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    node.x + node.width <= group.x + group.width &&
    node.y + node.height <= group.y + group.height
  )
}

/** Todo lo que hay dentro del grupo, grupos anidados y su contenido incluidos. */
export function childrenOf(group: CanvasNode, nodes: CanvasNode[]): CanvasNode[] {
  return nodes.filter((n) => n.id !== group.id && contains(group, n))
}

/** Rectángulo que envuelve los nodos con margen (para «Crear grupo»). Espacio extra arriba para el rótulo. */
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

/**
 * Orden vertical de los grupos: los grandes detrás, los anidados delante de su padre y todos detrás
 * de las tarjetas (zIndex negativo).
 */
export function groupZ(group: Rect): number {
  return -1 - Math.min(999, Math.round((group.width * group.height) / 10000))
}

/** Board de prueba (rendimiento): `count` tarjetas en rejilla, conectadas en cadena. */
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
