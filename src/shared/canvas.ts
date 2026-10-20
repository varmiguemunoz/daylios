import { normalizeStyle, type TextStyle } from './canvas-style'

export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6' | string
export type NodeType = 'text' | 'file' | 'link' | 'group'
export type ShapeKind = 'rect' | 'ellipse' | 'diamond'
export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface DayliosNodeMeta {
  kind?: 'sticky' | 'text' | 'shape'
  shape?: ShapeKind
  style?: TextStyle
}

export function withStyle(
  meta: DayliosNodeMeta | undefined,
  style: TextStyle | undefined
): DayliosNodeMeta | undefined {
  const next: DayliosNodeMeta = { ...meta }
  const clean = normalizeStyle(style)
  if (clean) next.style = clean
  else delete next.style
  return Object.keys(next).length ? next : undefined
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
  background?: string
  backgroundStyle?: 'cover' | 'ratio' | 'repeat'
  daylios?: DayliosNodeMeta
  [extra: string]: unknown
}

export interface CanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide?: Side
  toSide?: Side

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
    if (node.daylios && typeof node.daylios === 'object') {
      const meta = withStyle(node.daylios, node.daylios.style)
      if (meta) node.daylios = meta
      else delete node.daylios
    }
    outNodes.push(node)
  }
  const ids = new Set(outNodes.map((n) => n.id))
  const outEdges = (edges as CanvasEdge[]).filter(
    (e) => e && typeof e.id === 'string' && ids.has(e.fromNode) && ids.has(e.toNode)
  )
  return { ...raw, nodes: outNodes, edges: outEdges }
}

export function serializeCanvas(canvas: CanvasFile): string {
  return JSON.stringify(canvas, null, '\t')
}

export function canvasFileRefs(canvas: CanvasFile): string[] {
  return [
    ...new Set(canvas.nodes.filter((n) => n.type === 'file' && n.file).map((n) => n.file as string))
  ]
}

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

export type BoardLayout = 'flow-down' | 'flow-right' | 'tree' | 'grid'

export const BOARD_LAYOUTS: BoardLayout[] = ['flow-down', 'flow-right', 'tree', 'grid']

export interface BoardOpError {
  index: number
  message: string
}

export interface BoardEditResult {
  canvas: CanvasFile
  created: string[]
  errors: BoardOpError[]
}

export function planBoardOps(
  canvas: CanvasFile,
  ops: BoardOp[],
  options: { layout?: BoardLayout } = {}
): BoardEditResult {
  const nodes = canvas.nodes.map((n) => ({ ...n }))
  let edges = canvas.edges.map((e) => ({ ...e }))
  const created: string[] = []
  const unplaced: string[] = []
  const errors: BoardOpError[] = []
  const find = (id: string): CanvasNode => {
    const node = nodes.find((n) => n.id === id)
    if (!node) throw new Error(`No hay ningún nodo con id «${id}».`)
    return node
  }

  ops.forEach((op, index) => {
    try {
      switch (op.op) {
        case 'add_node': {
          const [w, h] = SIZE[op.kind] ?? SIZE.sticky
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
          if (nodes.some((n) => n.id === node.id))
            throw new Error(`Ya existe un nodo «${node.id}».`)
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
          if (op.x === undefined && op.y === undefined && node.type !== 'group')
            unplaced.push(node.id)
          break
        }
        case 'update_node': {
          const node = find(op.id)
          if (op.text !== undefined) node.text = op.text
          if (op.label !== undefined) node.label = op.label
          if (op.color === null) delete node.color
          else if (op.color !== undefined) node.color = op.color
          if (op.shape && node.daylios?.kind === 'shape')
            node.daylios = { ...node.daylios, kind: 'shape', shape: op.shape }
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
          if (edges.some((e) => e.id === edge.id))
            throw new Error(`Ya existe una conexión «${edge.id}».`)
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
    } catch (error) {
      errors.push({ index, message: error instanceof Error ? error.message : String(error) })
    }
  })

  if (options.layout && unplaced.length) layoutNodes(nodes, edges, unplaced, options.layout)
  return { canvas: { ...canvas, nodes, edges }, created, errors }
}

export const describeErrors = (errors: BoardOpError[], max = 20): string =>
  errors
    .slice(0, max)
    .map((e) => `Operación ${e.index + 1}: ${e.message}`)
    .concat(errors.length > max ? [`Y ${errors.length - max} errores más.`] : [])
    .join('\n')

export function applyBoardOps(
  canvas: CanvasFile,
  ops: BoardOp[],
  options: { layout?: BoardLayout } = {}
): { canvas: CanvasFile; created: string[] } {
  const result = planBoardOps(canvas, ops, options)
  if (result.errors.length) throw new Error(describeErrors(result.errors))
  return { canvas: result.canvas, created: result.created }
}

const GAP_X = 80
const GAP_Y = 100
const MARGIN = 160

const SIDES: Record<BoardLayout, [Side, Side] | null> = {
  'flow-down': ['bottom', 'top'],
  tree: ['bottom', 'top'],
  'flow-right': ['right', 'left'],
  grid: null
}

function layers(ids: string[], edges: CanvasEdge[]): string[][] {
  const inSet = new Set(ids)
  const inner = edges.filter(
    (e) => inSet.has(e.fromNode) && inSet.has(e.toNode) && e.fromNode !== e.toNode
  )
  const incoming = new Map(ids.map((id) => [id, 0]))
  for (const e of inner) incoming.set(e.toNode, (incoming.get(e.toNode) ?? 0) + 1)
  const level = new Map<string, number>()
  const queue = ids.filter((id) => incoming.get(id) === 0)
  if (!queue.length && ids.length) queue.push(ids[0])
  queue.forEach((id) => level.set(id, 0))
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of inner.filter((x) => x.fromNode === id)) {
      if (seen.has(e.toNode)) continue
      level.set(e.toNode, Math.max(level.get(e.toNode) ?? 0, (level.get(id) ?? 0) + 1))
      queue.push(e.toNode)
    }
  }
  let extra = Math.max(0, ...level.values()) + 1
  for (const id of ids) if (!level.has(id)) level.set(id, extra++)
  const rows: string[][] = []
  for (const id of ids) (rows[level.get(id) as number] ??= []).push(id)
  const result = rows.filter(Boolean)
  for (let i = 1; i < result.length; i++) {
    const order = new Map(result[i - 1].map((id, idx) => [id, idx]))
    const score = (id: string): number => {
      const parents = inner.filter((e) => e.toNode === id && order.has(e.fromNode))
      return parents.length
        ? parents.reduce((sum, e) => sum + (order.get(e.fromNode) as number), 0) / parents.length
        : Number.MAX_SAFE_INTEGER
    }
    result[i].sort((a, b) => score(a) - score(b))
  }
  return result
}

export function layoutNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  ids: string[],
  layout: BoardLayout
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const targets = ids.map((id) => byId.get(id)).filter((n): n is CanvasNode => Boolean(n))
  if (!targets.length) return
  const fixed = nodes.filter((n) => !ids.includes(n.id))
  const originX = fixed.length ? Math.max(...fixed.map((n) => n.x + n.width)) + MARGIN : 0
  const originY = fixed.length ? Math.min(...fixed.map((n) => n.y)) : 0

  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(targets.length))
    const cellW = Math.max(...targets.map((n) => n.width)) + GAP_X
    const cellH = Math.max(...targets.map((n) => n.height)) + GAP_Y
    targets.forEach((n, i) => {
      n.x = originX + (i % cols) * cellW
      n.y = originY + Math.floor(i / cols) * cellH
    })
    return
  }

  const rows = layers(
    targets.map((n) => n.id),
    edges
  ).map((row) => row.map((id) => byId.get(id) as CanvasNode))
  const horizontal = layout === 'flow-right'
  const along = (n: CanvasNode): number => (horizontal ? n.height : n.width)
  const across = (n: CanvasNode): number => (horizontal ? n.width : n.height)
  const spans = rows.map(
    (row) => row.reduce((sum, n) => sum + along(n), 0) + GAP_X * (row.length - 1)
  )
  const widest = Math.max(...spans)
  let depth = 0
  rows.forEach((row, r) => {
    let offset = (widest - spans[r]) / 2
    for (const n of row) {
      if (horizontal) {
        n.x = Math.round(originX + depth)
        n.y = Math.round(originY + offset)
      } else {
        n.x = Math.round(originX + offset)
        n.y = Math.round(originY + depth)
      }
      offset += along(n) + GAP_X
    }
    depth += Math.max(...row.map(across)) + GAP_Y
  })

  const sides = SIDES[layout]
  if (!sides) return
  const placed = new Set(ids)
  for (const e of edges) {
    if (!placed.has(e.fromNode) || !placed.has(e.toNode)) continue
    e.fromSide ??= sides[0]
    e.toSide ??= sides[1]
  }
}

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
