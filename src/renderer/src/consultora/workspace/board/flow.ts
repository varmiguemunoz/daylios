import { MarkerType, type Edge, type Node } from '@xyflow/react'
import {
  canvasId,
  type CanvasEdge,
  type CanvasFile,
  type CanvasNode,
  type ShapeKind,
  type Side
} from '@shared/canvas'
import { groupZ } from '@shared/canvas-groups'
import { IMAGE_EXT, extOf } from '@shared/workspace'

export type FlowKind = 'card' | 'text' | 'shape' | 'image' | 'note' | 'file' | 'link' | 'group'

export interface BoardNodeData extends Record<string, unknown> {
  canvas: CanvasNode
}

export type BoardNode = Node<BoardNodeData, FlowKind>

export interface BoardEdgeData extends Record<string, unknown> {
  canvas: CanvasEdge
}

export type BoardEdge = Edge<BoardEdgeData>

export const COLORS: { id: string; label: string; value: string }[] = [
  { id: '1', label: 'Rojo', value: '#fb464c' },
  { id: '2', label: 'Naranja', value: '#e9973f' },
  { id: '3', label: 'Amarillo', value: '#e0de71' },
  { id: '4', label: 'Verde', value: '#44cf6e' },
  { id: '5', label: 'Cian', value: '#53dfdd' },
  { id: '6', label: 'Violeta', value: '#a882ff' }
]

export const colorValue = (color?: string): string | null =>
  !color
    ? null
    : (COLORS.find((c) => c.id === color)?.value ??
      (/^#[0-9a-f]{3,8}$/i.test(color) ? color : null))

export function flowKind(n: CanvasNode): FlowKind {
  if (n.type === 'group') return 'group'
  if (n.type === 'link') return 'link'
  if (n.type === 'file') {
    const ext = extOf(n.file ?? '')
    if (IMAGE_EXT.includes(ext)) return 'image'
    return ext === '.md' ? 'note' : 'file'
  }
  const kind = n.daylios?.kind
  return kind === 'shape' ? 'shape' : kind === 'text' ? 'text' : 'card'
}

function bestSides(a: CanvasNode, b: CanvasNode): [Side, Side] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ['right', 'left'] : ['left', 'right']
  return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom']
}

export const ARROW = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#8c8c8c' }

export function toFlowNode(n: CanvasNode): BoardNode {
  return {
    id: n.id,
    type: flowKind(n),
    position: { x: n.x, y: n.y },
    width: n.width,
    height: n.height,
    zIndex: n.type === 'group' ? groupZ(n) : 0,
    data: { canvas: n }
  }
}

export function edgeFromCanvas(e: CanvasEdge, nodes: Map<string, CanvasNode>): BoardEdge {
  const [from, to] = bestSides(nodes.get(e.fromNode)!, nodes.get(e.toNode)!)
  return {
    id: e.id,
    type: 'ob',
    source: e.fromNode,
    target: e.toNode,
    sourceHandle: e.fromSide ?? from,
    targetHandle: e.toSide ?? to,
    label: e.label,
    markerEnd: e.toEnd === 'none' ? undefined : ARROW,
    markerStart: e.fromEnd === 'arrow' ? ARROW : undefined,
    data: { canvas: e }
  }
}

export function toFlow(canvas: CanvasFile): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]))
  return {
    nodes: canvas.nodes.map(toFlowNode),
    edges: canvas.edges.map((e) => edgeFromCanvas(e, byId))
  }
}

export function canvasOf(n: BoardNode): CanvasNode {
  return {
    ...n.data.canvas,
    id: n.id,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    width: Math.round(n.width ?? n.measured?.width ?? n.data.canvas.width),
    height: Math.round(n.height ?? n.measured?.height ?? n.data.canvas.height)
  }
}

export function fromFlow(nodes: BoardNode[], edges: BoardEdge[], base: CanvasFile): CanvasFile {
  return {
    ...base,
    nodes: nodes.map(canvasOf),
    edges: edges.map((e) => {
      const out: CanvasEdge = {
        ...(e.data?.canvas ?? {}),
        id: e.id,
        fromNode: e.source,
        toNode: e.target,
        toEnd: e.markerEnd ? 'arrow' : 'none',
        fromEnd: e.markerStart ? 'arrow' : 'none'
      }
      if (e.sourceHandle) out.fromSide = e.sourceHandle as Side
      if (e.targetHandle) out.toSide = e.targetHandle as Side
      if (typeof e.label === 'string' && e.label) out.label = e.label
      else delete out.label
      return out
    })
  }
}

// ---- nodos nuevos (como los crea Obsidian) ----

export const newId = canvasId

const at = (
  p: { x: number; y: number },
  w: number,
  h: number
): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'> => ({
  x: Math.round(p.x - w / 2),
  y: Math.round(p.y - h / 2),
  width: w,
  height: h
})

export function newCard(p: { x: number; y: number }): CanvasNode {
  return { id: newId(), type: 'text', text: '', ...at(p, 250, 60) }
}

export function newShape(p: { x: number; y: number }, shape: ShapeKind): CanvasNode {
  return {
    id: newId(),
    type: 'text',
    text: '',
    ...at(p, 180, 120),
    daylios: { kind: 'shape', shape }
  }
}

export function newFileNode(path: string, p: { x: number; y: number }, image: boolean): CanvasNode {
  return { id: newId(), type: 'file', file: path, ...(image ? at(p, 400, 280) : at(p, 400, 400)) }
}

export function newGroup(rect: {
  x: number
  y: number
  width: number
  height: number
}): CanvasNode {
  return { id: newId(), type: 'group', label: '', ...rect }
}
