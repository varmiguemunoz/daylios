import type { CanvasEdge, CanvasNode } from '@shared/canvas'
import { childrenOf, groupZ } from '@shared/canvas-groups'
import { canvasOf, edgeFromCanvas, newId, toFlowNode, type BoardEdge, type BoardNode } from './flow'

export function withChildren(nodes: BoardNode[], ids: Set<string>): Set<string> {
  const all = nodes.map(canvasOf)
  const out = new Set(ids)
  for (const n of all) {
    if (n.type !== 'group' || !ids.has(n.id)) continue
    for (const child of childrenOf(n, all)) out.add(child.id)
  }
  return out
}

export function passengers(
  nodes: BoardNode[],
  dragged: Set<string>
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  for (const id of withChildren(nodes, dragged)) {
    if (dragged.has(id)) continue
    const n = nodes.find((x) => x.id === id)
    if (n) out.set(id, { ...n.position })
  }
  return out
}

export function carry(
  nodes: BoardNode[],
  riders: Map<string, { x: number; y: number }>,
  delta: { x: number; y: number }
): BoardNode[] {
  if (!riders.size) return nodes
  return nodes.map((n) => {
    const start = riders.get(n.id)
    return start ? { ...n, position: { x: start.x + delta.x, y: start.y + delta.y } } : n
  })
}

export function restack(nodes: BoardNode[]): BoardNode[] {
  return nodes.map((n) => {
    if (n.type !== 'group') return n
    const z = groupZ(canvasOf(n))
    return n.zIndex === z ? n : { ...n, zIndex: z }
  })
}

export interface Clip {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export function copySelection(nodes: BoardNode[], edges: BoardEdge[]): Clip | null {
  const ids = withChildren(nodes, new Set(nodes.filter((n) => n.selected).map((n) => n.id)))
  if (!ids.size) return null
  return {
    nodes: nodes.filter((n) => ids.has(n.id)).map(canvasOf),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ ...(e.data?.canvas ?? {}), id: e.id, fromNode: e.source, toNode: e.target }))
  }
}

export function pasteClip(
  clip: Clip,
  offset: { x: number; y: number }
): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const ids = new Map(clip.nodes.map((n) => [n.id, newId()]))
  const canvasNodes = clip.nodes.map((n) => ({
    ...n,
    id: ids.get(n.id)!,
    x: n.x + offset.x,
    y: n.y + offset.y
  }))
  const byId = new Map(canvasNodes.map((n) => [n.id, n]))
  return {
    nodes: canvasNodes.map((n) => ({ ...toFlowNode(n), selected: true })),
    edges: clip.edges.map((e) =>
      edgeFromCanvas(
        { ...e, id: newId(), fromNode: ids.get(e.fromNode)!, toNode: ids.get(e.toNode)! },
        byId
      )
    )
  }
}
