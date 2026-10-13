/**
 * Boards en formato JSON Canvas 1.0 (el de Obsidian, https://jsoncanvas.org).
 * Se conservan los campos que no conocemos, así un archivo editado en Obsidian no pierde nada.
 * Extensión propia que Obsidian ignora: `daylios` en los nodos de texto.
 */

export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6' | string
export type NodeType = 'text' | 'file' | 'link' | 'group'
export type ShapeKind = 'rect' | 'ellipse' | 'diamond'
export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface DayliosNodeMeta {
  /** sticky = nota adhesiva; text = bloque sin fondo; shape = forma con texto. */
  kind: 'sticky' | 'text' | 'shape'
  shape?: ShapeKind
}

export interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  color?: CanvasColor
  text?: string
  file?: string
  url?: string
  label?: string
  daylios?: DayliosNodeMeta
  [extra: string]: unknown
}

export interface CanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide?: Side
  toSide?: Side
  /** Por defecto `none` en el origen y `arrow` en el destino. */
  fromEnd?: 'none' | 'arrow'
  toEnd?: 'none' | 'arrow'
  color?: CanvasColor
  label?: string
  [extra: string]: unknown
}

export interface CanvasFile {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  [extra: string]: unknown
}

export const EMPTY_CANVAS: CanvasFile = { nodes: [], edges: [] }

const NODE_TYPES: NodeType[] = ['text', 'file', 'link', 'group']
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Lee y valida. Lanza Error con un mensaje claro si no es un canvas válido. Vacío = canvas vacío. */
export function parseCanvas(json: string): CanvasFile {
  if (!json.trim()) return { nodes: [], edges: [] }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('El board no es JSON válido.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('El board no es un JSON Canvas.')
  const raw = data as Record<string, unknown>
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const edges = Array.isArray(raw.edges) ? raw.edges : []

  const outNodes: CanvasNode[] = []
  for (const n of nodes) {
    const node = n as CanvasNode
    if (!node || typeof node.id !== 'string' || !NODE_TYPES.includes(node.type)) continue
    if (![node.x, node.y, node.width, node.height].every(num)) continue
    outNodes.push(node)
  }
  const ids = new Set(outNodes.map((n) => n.id))
  const outEdges = (edges as CanvasEdge[]).filter(
    (e) => e && typeof e.id === 'string' && ids.has(e.fromNode) && ids.has(e.toNode)
  )
  return { ...raw, nodes: outNodes, edges: outEdges }
}

/** JSON con tabuladores, como lo escribe Obsidian: diffs limpios. */
export function serializeCanvas(canvas: CanvasFile): string {
  return JSON.stringify(canvas, null, '\t')
}

/** Rutas de la bóveda que el board usa (nodos `file`). */
export function canvasFileRefs(canvas: CanvasFile): string[] {
  return [
    ...new Set(canvas.nodes.filter((n) => n.type === 'file' && n.file).map((n) => n.file as string))
  ]
}

/** Actualiza las rutas de los nodos `file` tras mover elementos (ruta vieja → nueva). */
export function rewriteCanvasFiles(canvas: CanvasFile, moved: Map<string, string>): CanvasFile {
  let changed = false
  const nodes = canvas.nodes.map((n) => {
    const next = n.type === 'file' && n.file ? moved.get(n.file) : undefined
    if (!next) return n
    changed = true
    return { ...n, file: next }
  })
  return changed ? { ...canvas, nodes } : canvas
}

// ---- edición por operaciones (Claude edita un board sin reescribirlo entero) ----

let seq = 0
/** Id corto como los de Obsidian (16 hex). */
export const canvasId = (): string =>
  (Date.now().toString(16) + (seq++).toString(16) + Math.random().toString(16).slice(2)).slice(
    0,
    16
  )

export type NodeKind = 'sticky' | 'text' | 'shape' | 'file' | 'link' | 'group'

export type BoardOp =
  | {
      op: 'add_node'
      kind: NodeKind
      id?: string
      text?: string
      file?: string
      url?: string
      label?: string
      color?: string
      shape?: ShapeKind
      x?: number
      y?: number
      width?: number
      height?: number
    }
  | {
      op: 'update_node'
      id: string
      text?: string
      label?: string
      color?: string | null
      shape?: ShapeKind
      x?: number
      y?: number
      width?: number
      height?: number
    }
  | { op: 'remove_node'; id: string }
  | {
      op: 'add_edge'
      from: string
      to: string
      id?: string
      label?: string
      arrow?: 'none' | 'end' | 'both'
    }
  | { op: 'remove_edge'; id: string }

const SIZE: Record<NodeKind, [number, number]> = {
  sticky: [220, 160],
  text: [260, 60],
  shape: [180, 120],
  file: [320, 220],
  link: [280, 80],
  group: [600, 400]
}

/** Aplica operaciones sobre una copia. Lanza Error con mensaje claro si una no es válida. */
export function applyBoardOps(
  canvas: CanvasFile,
  ops: BoardOp[]
): { canvas: CanvasFile; created: string[] } {
  const nodes = canvas.nodes.map((n) => ({ ...n }))
  let edges = canvas.edges.map((e) => ({ ...e }))
  const created: string[] = []
  const find = (id: string): CanvasNode => {
    const node = nodes.find((n) => n.id === id)
    if (!node) throw new Error(`No hay ningún nodo con id «${id}».`)
    return node
  }

  for (const op of ops) {
    switch (op.op) {
      case 'add_node': {
        const [w, h] = SIZE[op.kind]
        // Sin posición: a la derecha de todo lo que ya hay.
        const right = nodes.length ? Math.max(...nodes.map((n) => n.x + n.width)) + 60 : 0
        const node: CanvasNode = {
          id: op.id ?? canvasId(),
          type:
            op.kind === 'group'
              ? 'group'
              : op.kind === 'file'
                ? 'file'
                : op.kind === 'link'
                  ? 'link'
                  : 'text',
          x: Math.round(op.x ?? right),
          y: Math.round(op.y ?? 0),
          width: Math.round(op.width ?? w),
          height: Math.round(op.height ?? h)
        }
        if (nodes.some((n) => n.id === node.id)) throw new Error(`Ya existe un nodo «${node.id}».`)
        if (node.type === 'text') {
          node.text = op.text ?? ''
          node.daylios = {
            kind: op.kind as DayliosNodeMeta['kind'],
            ...(op.kind === 'shape' ? { shape: op.shape ?? 'rect' } : {})
          }
        }
        if (node.type === 'file') {
          if (!op.file)
            throw new Error('Un nodo de archivo necesita `file` (ruta en el workspace).')
          node.file = op.file
        }
        if (node.type === 'link') {
          if (!op.url) throw new Error('Un nodo de enlace necesita `url`.')
          node.url = op.url
        }
        if (node.type === 'group') node.label = op.label ?? 'Grupo'
        if (op.color) node.color = op.color
        else if (op.kind === 'sticky') node.color = '3'
        nodes.push(node)
        created.push(node.id)
        break
      }
      case 'update_node': {
        const node = find(op.id)
        if (op.text !== undefined) node.text = op.text
        if (op.label !== undefined) node.label = op.label
        if (op.color === null) delete node.color
        else if (op.color !== undefined) node.color = op.color
        if (op.shape && node.daylios?.kind === 'shape')
          node.daylios = { kind: 'shape', shape: op.shape }
        for (const k of ['x', 'y', 'width', 'height'] as const) {
          const v = op[k]
          if (typeof v === 'number' && Number.isFinite(v)) node[k] = Math.round(v)
        }
        break
      }
      case 'remove_node': {
        find(op.id)
        nodes.splice(
          nodes.findIndex((n) => n.id === op.id),
          1
        )
        edges = edges.filter((e) => e.fromNode !== op.id && e.toNode !== op.id)
        break
      }
      case 'add_edge': {
        find(op.from)
        find(op.to)
        const edge: CanvasEdge = {
          id: op.id ?? canvasId(),
          fromNode: op.from,
          toNode: op.to,
          fromEnd: op.arrow === 'both' ? 'arrow' : 'none',
          toEnd: op.arrow === 'none' ? 'none' : 'arrow'
        }
        if (op.label) edge.label = op.label
        edges.push(edge)
        created.push(edge.id)
        break
      }
      case 'remove_edge': {
        if (!edges.some((e) => e.id === op.id))
          throw new Error(`No hay ninguna conexión con id «${op.id}».`)
        edges = edges.filter((e) => e.id !== op.id)
        break
      }
      default:
        throw new Error('Operación desconocida.')
    }
  }
  return { canvas: { ...canvas, nodes, edges }, created }
}

/** Vista compacta para leer un board (Claude). */
export function summarizeCanvas(canvas: CanvasFile): {
  nodes: {
    id: string
    kind: string
    text?: string
    file?: string
    url?: string
    label?: string
    color?: string
    x: number
    y: number
    width: number
    height: number
  }[]
  edges: { id: string; from: string; to: string; label?: string; arrow: 'none' | 'end' | 'both' }[]
} {
  return {
    nodes: canvas.nodes.map((n) => ({
      id: n.id,
      kind:
        n.type === 'text'
          ? n.daylios?.kind === 'shape'
            ? `shape:${n.daylios.shape ?? 'rect'}`
            : (n.daylios?.kind ?? 'sticky')
          : n.type,
      ...(n.text !== undefined ? { text: n.text } : {}),
      ...(n.file ? { file: n.file } : {}),
      ...(n.url ? { url: n.url } : {}),
      ...(n.label ? { label: n.label } : {}),
      ...(n.color ? { color: n.color } : {}),
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height
    })),
    edges: canvas.edges.map((e) => ({
      id: e.id,
      from: e.fromNode,
      to: e.toNode,
      ...(e.label ? { label: e.label } : {}),
      arrow: e.fromEnd === 'arrow' ? 'both' : e.toEnd === 'none' ? 'none' : 'end'
    }))
  }
}
