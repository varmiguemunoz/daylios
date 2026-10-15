import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeTypes,
  type FinalConnectionState,
  type NodeChange,
  type NodePositionChange,
  type NodeTypes,
  type OnBeforeDelete,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { Circle, Diamond, Lock, Square } from 'lucide-react'
import type { CanvasEdge, CanvasFile, CanvasNode, ShapeKind } from '@shared/canvas'
import { groupAround, type Rect } from '@shared/canvas-groups'
import { IMAGE_EXT, dirName, extOf } from '@shared/workspace'
import { NotePicker } from '../../../components/NotePicker'
import { useContextMenu, type MenuEntry } from '../../../ui'
import { errorMessage, notesApi } from '../../../lib/api'
import { DRAG_TYPE, prefs, ws } from '../lib'
import { uiState } from '../../../lib/ui-state'
import { BoardContext, EditingContext, createEditingStore } from './context'
import {
  ARROW,
  canvasOf,
  flowKind,
  fromFlow,
  newCard,
  newFileNode,
  newGroup,
  newId,
  newLink,
  newShape,
  toFlowNode,
  type BoardEdge,
  type BoardNode
} from './flow'
import { useHistory } from './history'
import {
  carry,
  copySelection,
  moveTo,
  passengers,
  pasteClip,
  restack,
  withChildren,
  type Clip
} from './ops'
import { CARD_DRAG, CardToolbar, type AddKind } from './CardToolbar'
import { CanvasControls } from './CanvasControls'
import { EdgeMenu, SelectionMenu } from './SelectionMenu'
import { GroupDeleteModal } from './GroupDeleteModal'
import { ObsidianEdge } from './ObsidianEdge'
import { CardNode, ShapeNode, TextNode } from './nodes/CardNodes'
import { GroupNode } from './nodes/GroupNode'
import { FileNode, ImageNode, LinkNode, NoteNode } from './nodes/FileNodes'
import { PdfNode } from './nodes/PdfNode'
import { align, distribute, type AlignMode } from './align'
import { boundsOf, intersects, lockAxis, snapToObjects, type Guide, type Point } from './snap'
import { ALIGN_ITEMS, edgeItems, nodeItems, paneItems } from './menus'
import { useBoardKeys, useModifiers } from './useBoardKeys'
import { FIT, GRID, MAX_ZOOM, MIN_ZOOM, PASTE_OFFSET, SNAP_PX } from './viewport'
import { LinkModal } from './LinkModal'
import { SnapGuides } from './SnapGuides'
import { ZoomVar } from './ZoomVar'
import { ShortcutsModal } from './ShortcutsModal'

const NODE_TYPES: NodeTypes = {
  card: CardNode,
  text: TextNode,
  shape: ShapeNode,
  group: GroupNode,
  image: ImageNode,
  note: NoteNode,
  pdf: PdfNode,
  file: FileNode,
  link: LinkNode
}
const EDGE_TYPES: EdgeTypes = { ob: ObsidianEdge }

const MINIMAP_KEY = 'ws.board.minimap'
const SNAP_GRID_KEY = 'ws.board.snapGrid'
const SNAP_OBJECTS_KEY = 'ws.board.snapObjects'
const NO_GUIDES: Guide[] = []
const EDITABLE = new Set(['card', 'text', 'shape', 'group'])
const TEXTUAL = new Set(['card', 'text', 'shape'])
const OPPOSITE: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
}

interface BoardCanvasProps {
  path: string

  folderId: string | null
  initial: { nodes: BoardNode[]; edges: BoardEdge[] }

  base: CanvasFile

  onDirty: () => void

  snapshotRef: React.RefObject<(() => CanvasFile) | null>
  onOpenPath: (path: string) => void
  onError: (message: string | null) => void

  viewportKey: string
}

const clean = (nodes: BoardNode[]): BoardNode[] =>
  nodes.map((n) => ({ ...n, selected: false, dragging: false }))

const deselected = <T extends { selected?: boolean }>(list: T[]): T[] =>
  list.map((x) => (x.selected ? { ...x, selected: false } : x))

const noteName = (text: string): string =>
  (
    text
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').trim())
      .find(Boolean) ?? 'Tarjeta'
  ).slice(0, 60)

const cosmetic = (c: NodeChange<BoardNode>): boolean =>
  c.type === 'select' || (c.type === 'dimensions' && c.resizing === undefined && !c.setAttributes)

const edgeBetween = (
  c: Pick<Connection, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>
): BoardEdge => {
  const id = newId()
  const canvasEdge: CanvasEdge = { id, fromNode: c.source, toNode: c.target }
  return {
    id,
    type: 'ob',
    source: c.source,
    target: c.target,
    sourceHandle: c.sourceHandle,
    targetHandle: c.targetHandle,
    markerEnd: ARROW,
    data: { canvas: canvasEdge }
  }
}

export function BoardCanvas({
  path,
  folderId,
  initial,
  base,
  onDirty,
  snapshotRef,
  onOpenPath,
  onError,
  viewportKey
}: BoardCanvasProps): React.JSX.Element {
  const readOnlyKey = `${viewportKey}:ro`
  // Se vuelve al zoom y posición de la última vez; sin recuerdo, se encuadra todo.
  const [savedViewport] = useState(() => {
    const v = uiState.get<Viewport | null>(viewportKey, null)
    return v && [v.x, v.y, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))
      ? v
      : null
  })
  const [nodes, setNodes] = useState<BoardNode[]>(initial.nodes)
  const [edges, setEdges] = useState<BoardEdge[]>(initial.edges)
  const [editing] = useState(createEditingStore)
  const [picking, setPicking] = useState<Point | null>(null)
  const [linking, setLinking] = useState<Point | null>(null)
  const [minimap, setMinimap] = useState(() => prefs.get(MINIMAP_KEY) === '1')
  const [snapGrid, setSnapGrid] = useState(() => prefs.get(SNAP_GRID_KEY) !== '0')
  const [snapObjects, setSnapObjects] = useState(() => prefs.get(SNAP_OBJECTS_KEY) !== '0')
  const [readOnly, setReadOnly] = useState(() => uiState.get<boolean>(readOnlyKey, false) === true)
  const [guides, setGuides] = useState<Guide[]>(NO_GUIDES)
  const [labelingId, setLabelingId] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [groupDelete, setGroupDelete] = useState<{
    count: number
    resolve: (choice: 'cancel' | 'group' | 'all') => void
  } | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const clip = useRef<Clip | null>(null)
  const riders = useRef(new Map<string, Point>())
  const starts = useRef(new Map<string, Point>())
  const sizes = useRef(new Map<string, { width: number; height: number }>())
  const targets = useRef<Rect[]>([])
  const lastPos = useRef(new Map<string, Point>())
  const lead = useRef<Point | null>(null)
  const leadId = useRef<string | null>(null)
  const cloning = useRef(false)
  const pointer = useRef<Point | null>(null)
  const resizing = useRef(false)
  const flow = useReactFlow<BoardNode, BoardEdge>()
  const menu = useContextMenu()
  const { free, mods } = useModifiers()

  const latest = useRef({ nodes, edges })
  const settings = useRef({ free, snapObjects })
  useLayoutEffect(() => {
    latest.current = { nodes, edges }
    settings.current = { free, snapObjects }
  })

  // El padre pide el canvas solo cuando va a guardar.
  useLayoutEffect(() => {
    snapshotRef.current = () => fromFlow(latest.current.nodes, latest.current.edges, base)
  }, [snapshotRef, base])

  const history = useHistory(
    useCallback(() => ({ nodes: clean(latest.current.nodes), edges: latest.current.edges }), []),
    useCallback(
      (s: { nodes: BoardNode[]; edges: BoardEdge[] }) => {
        setNodes(s.nodes)
        setEdges(s.edges)
        onDirty()
      },
      [onDirty]
    )
  )
  const { checkpoint } = history

  const visibleRect = useCallback((): Rect => {
    const box = wrapper.current?.getBoundingClientRect()
    if (!box) return { x: -Infinity, y: -Infinity, width: Infinity, height: Infinity }
    const a = flow.screenToFlowPosition({ x: box.left, y: box.top })
    const b = flow.screenToFlowPosition({ x: box.right, y: box.bottom })
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }
  }, [flow])

  const dragChanges = useCallback(
    (changes: NodeChange<BoardNode>[]): NodeChange<BoardNode>[] => {
      const moving = changes.filter(
        (c): c is NodePositionChange =>
          c.type === 'position' && Boolean(c.position) && starts.current.has(c.id)
      )
      if (!moving.length) return changes
      if (!moving.some((c) => c.dragging))
        return changes.map((c) => {
          const at = c.type === 'position' ? lastPos.current.get(c.id) : undefined
          return at ? { ...c, position: at } : c
        })
      const head = moving.find((c) => c.id === leadId.current) ?? moving[0]
      const first = starts.current.get(head.id)!
      let delta = { x: head.position!.x - first.x, y: head.position!.y - first.y }
      if (mods.current.shift) delta = lockAxis(delta)
      const placed = (d: Point): Rect[] =>
        moving.map((c) => {
          const start = starts.current.get(c.id)!
          const size = sizes.current.get(c.id) ?? { width: 0, height: 0 }
          return { x: start.x + d.x, y: start.y + d.y, ...size }
        })
      if (!settings.current.free && settings.current.snapObjects && targets.current.length) {
        const snap = snapToObjects(
          boundsOf(placed(delta)),
          targets.current,
          SNAP_PX / flow.getZoom()
        )
        delta = { x: delta.x + snap.dx, y: delta.y + snap.dy }
        setGuides(snap.guides.length ? snap.guides : NO_GUIDES)
      }
      lead.current = delta
      lastPos.current = new Map(
        moving.map((c) => {
          const start = starts.current.get(c.id)!
          return [c.id, { x: start.x + delta.x, y: start.y + delta.y }]
        })
      )
      return changes.map((c) => {
        const at = c.type === 'position' ? lastPos.current.get(c.id) : undefined
        return at ? { ...c, position: at } : c
      })
    },
    [flow, mods]
  )

  // ---- cambios de React Flow ----

  const onNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      if (changes.some((c) => c.type === 'remove')) checkpoint()
      const resize = changes.find((c) => c.type === 'dimensions' && c.resizing)
      if (resize && !resizing.current) checkpoint()
      const resized = resizing.current && !resize
      resizing.current = Boolean(resize)
      const applied = starts.current.size ? dragChanges(changes) : changes
      const delta = lead.current
      setNodes((ns) => {
        let next = applyNodeChanges(applied, ns)
        if (delta && riders.current.size) next = carry(next, riders.current, delta)
        return resized ? restack(next) : next
      })
      if (!changes.every(cosmetic)) onDirty()
    },
    [checkpoint, onDirty, dragChanges]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<BoardEdge>[]) => {
      if (changes.some((c) => c.type === 'remove')) checkpoint()
      setEdges((es) => applyEdgeChanges(changes, es))
      if (changes.some((c) => c.type !== 'select')) onDirty()
    },
    [checkpoint, onDirty]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return
      checkpoint()
      setEdges((es) => [...es, edgeBetween(c)])
      onDirty()
    },
    [checkpoint, onDirty]
  )

  const addNodes = useCallback(
    (list: CanvasNode[], extraEdges: BoardEdge[] = [], edit = false) => {
      if (!list.length) return
      checkpoint()
      setNodes((ns) => [
        ...deselected(ns),
        ...list.map((n) => ({ ...toFlowNode(n), selected: true }))
      ])
      if (extraEdges.length) setEdges((es) => [...es, ...extraEdges])
      if (edit) editing.set(list[0].id)
      onDirty()
    },
    [checkpoint, onDirty, editing]
  )

  // Soltar una conexión en el vacío crea una tarjeta conectada, lista para escribir (como Obsidian).
  const onConnectEnd = useCallback(
    (e: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode) return
      const point = 'changedTouches' in e ? e.changedTouches[0] : e
      const at = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY })
      const card = newCard(at)
      const side = state.fromHandle?.id ?? 'right'
      const opposite = OPPOSITE[side] ?? 'left'
      addNodes(
        [card],
        [
          edgeBetween({
            source: state.fromNode.id,
            target: card.id,
            sourceHandle: side,
            targetHandle: opposite
          })
        ],
        true
      )
    },
    [flow, addNodes]
  )

  // ---- grupos: lo que está dentro se mueve con ellos ----

  const cloneBack = useCallback(
    (origin: Map<string, Point>) => {
      const { nodes: ns, edges: es } = latest.current
      const copy = copySelection(ns, es)
      if (!copy) return
      const pasted = pasteClip(copy, { x: 0, y: 0 })
      setNodes([...moveTo(deselected(ns), origin), ...pasted.nodes])
      setEdges([...deselected(es), ...pasted.edges])
      onDirty()
    },
    [onDirty]
  )

  const onNodeDragStart = useCallback(
    (event: MouseEvent | TouchEvent, node: BoardNode, dragged: BoardNode[]) => {
      checkpoint()
      leadId.current = node.id
      const all = latest.current.nodes
      const ids = new Set(dragged.map((n) => n.id))
      starts.current = new Map(dragged.map((n) => [n.id, { ...n.position }]))
      sizes.current = new Map(
        dragged.map((n) => {
          const c = canvasOf(n)
          return [n.id, { width: c.width, height: c.height }]
        })
      )
      riders.current = passengers(all, ids)
      const skip = new Set([...ids, ...riders.current.keys()])
      const view = visibleRect()
      targets.current = all
        .filter((n) => !skip.has(n.id))
        .map(canvasOf)
        .filter((r) => intersects(r, view))
      lead.current = null
      cloning.current = event.altKey || mods.current.alt
    },
    [checkpoint, visibleRect, mods]
  )

  const onNodeDragStop = useCallback(() => {
    const origin = cloning.current ? new Map([...starts.current, ...riders.current]) : null
    starts.current = new Map()
    riders.current = new Map()
    lastPos.current = new Map()
    lead.current = null
    cloning.current = false
    setGuides(NO_GUIDES)
    if (origin) requestAnimationFrame(() => cloneBack(origin))
    onDirty()
  }, [onDirty, cloneBack])

  // Borrar un grupo con contenido pregunta qué hacer.
  const onBeforeDelete: OnBeforeDelete<BoardNode, BoardEdge> = useCallback(
    async ({ nodes: gone, edges: goneEdges }) => {
      const all = latest.current.nodes
      const ids = new Set(gone.map((n) => n.id))
      const inside = [...withChildren(all, ids)].filter((id) => !ids.has(id))
      if (!inside.length) return true
      const choice = await new Promise<'cancel' | 'group' | 'all'>((resolve) =>
        setGroupDelete({ count: inside.length, resolve })
      )
      setGroupDelete(null)
      if (choice === 'cancel') return false
      if (choice === 'group') return true
      const every = new Set([...ids, ...inside])
      return {
        nodes: all.filter((n) => every.has(n.id)),
        edges: [
          ...goneEdges,
          ...latest.current.edges.filter((e) => every.has(e.source) || every.has(e.target))
        ]
      }
    },
    []
  )

  // ---- acciones ----

  const center = (): Point => {
    const box = wrapper.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }

  const placeFiles = async (paths: string[], at: Point): Promise<void> => {
    if (!paths.length) return
    try {
      const items = await ws.upload(folderId, paths)
      addNodes(
        items.map((item, i) =>
          newFileNode(
            item.path,
            { x: at.x + i * 40, y: at.y + i * 40 },
            IMAGE_EXT.includes(extOf(item.path))
          )
        )
      )
      onError(null)
    } catch (e) {
      onError(errorMessage(e))
    }
  }

  const groupSelection = (): void => {
    const picked = latest.current.nodes.filter((n) => n.selected)
    if (!picked.length) return
    addNodes([newGroup(groupAround(picked.map(canvasOf)))], [], true)
  }

  const emptyGroup = (at: Point, centered: boolean): void =>
    addNodes(
      [
        newGroup({
          x: Math.round(centered ? at.x - 200 : at.x),
          y: Math.round(centered ? at.y - 150 : at.y),
          width: 400,
          height: 300
        })
      ],
      [],
      true
    )

  const add = (kind: AddKind, anchor: HTMLElement | null, at = center(), dropped = false): void => {
    if (kind === 'card') addNodes([newCard(at)], [], true)
    else if (kind === 'note') setPicking(at)
    else if (kind === 'media') void ws.pickFiles().then((paths) => placeFiles(paths, at))
    else if (kind === 'group') {
      if (!dropped && latest.current.nodes.some((n) => n.selected)) groupSelection()
      else emptyGroup(at, true)
    } else if (anchor) {
      const shape = (s: ShapeKind): void => addNodes([newShape(at, s)], [], true)
      menu.openFrom(anchor, [
        { label: 'Rectángulo', icon: <Square size={15} />, onSelect: () => shape('rect') },
        { label: 'Elipse', icon: <Circle size={15} />, onSelect: () => shape('ellipse') },
        { label: 'Rombo', icon: <Diamond size={15} />, onSelect: () => shape('diamond') }
      ])
    }
  }

  const patch = useCallback(
    (id: string, change: Partial<CanvasNode>) => {
      checkpoint()
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n
          const next = { ...n.data.canvas, ...change }
          return { ...n, type: flowKind(next), data: { canvas: next } }
        })
      )
      onDirty()
    },
    [checkpoint, onDirty]
  )

  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)

  const patchSelected = (change: (n: CanvasNode) => Partial<CanvasNode>): void => {
    checkpoint()
    setNodes((ns) =>
      ns.map((n) => {
        if (!n.selected) return n
        const next = { ...n.data.canvas, ...change(n.data.canvas) }
        if (next.color === undefined) delete next.color
        return { ...n, type: flowKind(next), data: { canvas: next } }
      })
    )
    onDirty()
  }

  const patchEdge = (id: string, change: (e: BoardEdge) => BoardEdge): void => {
    checkpoint()
    setEdges((es) => es.map((e) => (e.id === id ? change(e) : e)))
    onDirty()
  }

  const removeSelected = (): void =>
    void flow.deleteElements({
      nodes: latest.current.nodes.filter((n) => n.selected),
      edges: latest.current.edges.filter((e) => e.selected)
    })

  const paste = (offset: Point): void => {
    if (!clip.current) return
    const pasted = pasteClip(clip.current, offset)
    checkpoint()
    setNodes((ns) => [...deselected(ns), ...pasted.nodes])
    setEdges((es) => [...deselected(es), ...pasted.edges])
    // Pegar varias veces seguidas escalona las copias.
    clip.current = {
      nodes: pasted.nodes.map(canvasOf),
      edges: pasted.edges.map((e) => ({
        ...e.data!.canvas,
        id: e.id,
        fromNode: e.source,
        toNode: e.target
      }))
    }
    onDirty()
  }

  const pasteAtPointer = (): void => {
    if (!clip.current?.nodes.length) return
    const p = pointer.current
    const box = wrapper.current?.getBoundingClientRect()
    const inside =
      p && box && p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom
    if (!inside) return paste({ x: PASTE_OFFSET, y: PASTE_OFFSET })
    const at = flow.screenToFlowPosition(p)
    const area = boundsOf(clip.current.nodes)
    paste({
      x: Math.round(at.x - (area.x + area.width / 2)),
      y: Math.round(at.y - (area.y + area.height / 2))
    })
  }

  const copy = (): void => {
    clip.current = copySelection(latest.current.nodes, latest.current.edges) ?? clip.current
  }

  const duplicate = (): void => {
    const picked = copySelection(latest.current.nodes, latest.current.edges)
    if (!picked) return
    clip.current = picked
    paste({ x: GRID * 2, y: GRID * 2 })
  }

  const nudge = (dx: number, dy: number): void => {
    const ids = withChildren(
      latest.current.nodes,
      new Set(latest.current.nodes.filter((n) => n.selected).map((n) => n.id))
    )
    if (!ids.size) return
    checkpoint()
    setNodes((ns) =>
      ns.map((n) =>
        ids.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
      )
    )
    onDirty()
  }

  const arrange = (mode: AlignMode | 'x' | 'y'): void => {
    const picked = latest.current.nodes.filter((n) => n.selected).map(canvasOf)
    const moves = mode === 'x' || mode === 'y' ? distribute(picked, mode) : align(picked, mode)
    if (!moves.size) return
    checkpoint()
    setNodes((ns) => moveTo(ns, moves))
    onDirty()
  }

  const fit = (): void => void flow.fitView(FIT)

  const zoomToSelection = (): void => {
    const picked = latest.current.nodes.filter((n) => n.selected)
    if (picked.length) void flow.fitView({ ...FIT, nodes: picked.map((n) => ({ id: n.id })) })
  }

  const selectOnlyNode = (id: string): void => {
    setNodes((ns) =>
      ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id }))
    )
    setEdges(deselected)
  }

  const selectOnlyEdge = (id: string): void => {
    setNodes(deselected)
    setEdges((es) =>
      es.map((e) => (e.selected === (e.id === id) ? e : { ...e, selected: e.id === id }))
    )
  }

  const convertToNote = async (node: BoardNode): Promise<void> => {
    const text = node.data.canvas.text ?? ''
    try {
      const item = await ws.createNote(folderId, noteName(text), text)
      patch(node.id, { type: 'file', file: item.path, text: undefined, daylios: undefined })
      onError(null)
    } catch (e) {
      onError(errorMessage(e))
    }
  }

  const toggleReadOnly = (): void => {
    const next = !readOnly
    setReadOnly(next)
    uiState.set(readOnlyKey, next)
    editing.set(null)
    setLabelingId(null)
  }

  const toggleSnapGrid = (): void => {
    setSnapGrid(!snapGrid)
    prefs.set(SNAP_GRID_KEY, snapGrid ? '0' : '1')
  }

  const toggleSnapObjects = (): void => {
    setSnapObjects(!snapObjects)
    prefs.set(SNAP_OBJECTS_KEY, snapObjects ? '0' : '1')
  }

  const openSettings = (anchor: HTMLElement): void =>
    menu.openFrom(anchor, [
      { label: 'Ajustar a la rejilla', checked: snapGrid, onSelect: toggleSnapGrid },
      { label: 'Ajustar a objetos', checked: snapObjects, onSelect: toggleSnapObjects },
      { label: 'Solo lectura', checked: readOnly, onSelect: toggleReadOnly }
    ])

  const pickBackground = async (group: BoardNode): Promise<void> => {
    try {
      const paths = (await ws.pickFiles()).filter((p) => IMAGE_EXT.includes(extOf(p)))
      if (!paths.length) return
      const [item] = await ws.upload(folderId, paths.slice(0, 1))
      patch(group.id, {
        background: item.path,
        backgroundStyle: group.data.canvas.backgroundStyle ?? 'cover'
      })
      onError(null)
    } catch (e) {
      onError(errorMessage(e))
    }
  }

  const openBackgroundMenu = (anchor: HTMLElement): void => {
    const group = latest.current.nodes.find((n) => n.selected && n.type === 'group')
    if (!group) return
    const current = group.data.canvas
    const fit = (style: 'cover' | 'ratio' | 'repeat', label: string): MenuEntry => ({
      label,
      checked: (current.backgroundStyle ?? 'cover') === style,
      onSelect: () => patch(group.id, { backgroundStyle: style })
    })
    menu.openFrom(anchor, [
      { label: 'Elegir imagen', onSelect: () => void pickBackground(group) },
      ...(current.background
        ? [
            null,
            fit('cover', 'Cubrir'),
            fit('ratio', 'Ajustar'),
            fit('repeat', 'Repetir'),
            null,
            {
              label: 'Quitar fondo',
              danger: true,
              onSelect: () => patch(group.id, { background: undefined, backgroundStyle: undefined })
            }
          ]
        : [])
    ])
  }

  const openAlignMenu = (anchor: HTMLElement): void =>
    menu.openFrom(
      anchor,
      ALIGN_ITEMS.flatMap((item, i) => [
        ...(i === 6 ? [null] : []),
        { label: item.label, onSelect: () => arrange(item.mode) }
      ])
    )

  const onNodeContextMenu = (e: React.MouseEvent, node: BoardNode): void => {
    e.preventDefault()
    const already = node.selected
    if (!already) selectOnlyNode(node.id)
    const count = already ? latest.current.nodes.filter((n) => n.selected).length : 1
    const file = node.data.canvas.file
    const editable = EDITABLE.has(node.type ?? '')
    menu.openAt(
      e,
      nodeItems({
        readOnly,
        count,
        canEdit: readOnly ? Boolean(file) : editable || Boolean(file),
        canConvert: TEXTUAL.has(node.type ?? '') && Boolean(node.data.canvas.text?.trim()),
        canGroup: count > 1 || node.type !== 'group',
        zoom: zoomToSelection,
        edit: () => (editable && !readOnly ? editing.set(node.id) : file && onOpenPath(file)),
        convert: () => void convertToNote(node),
        cut: () => {
          copy()
          removeSelected()
        },
        copy,
        duplicate,
        group: groupSelection,
        remove: removeSelected
      })
    )
  }

  const onEdgeContextMenu = (e: React.MouseEvent, edge: BoardEdge): void => {
    e.preventDefault()
    selectOnlyEdge(edge.id)
    menu.openAt(
      e,
      edgeItems({
        readOnly,
        label: () => setLabelingId(edge.id),
        follow: () => void flow.fitView({ ...FIT, nodes: [{ id: edge.target }] }),
        remove: () => void flow.deleteElements({ edges: [edge] })
      })
    )
  }

  useBoardKeys({
    readOnly,
    nudge,
    deselect: () => setNodes(deselected),
    fit,
    zoomToSelection,
    undo: history.undo,
    redo: history.redo,
    selectAll: () => setNodes((ns) => ns.map((n) => (n.selected ? n : { ...n, selected: true }))),
    group: groupSelection,
    copy,
    cut: () => {
      copy()
      removeSelected()
    },
    paste: pasteAtPointer,
    duplicate,
    zoomIn: () => void flow.zoomIn({ duration: 150 }),
    zoomOut: () => void flow.zoomOut({ duration: 150 }),
    zoomReset: () => void flow.zoomTo(1, { duration: 150 })
  })

  const actions = useMemo(
    () => ({ patch, openPath: onOpenPath, base: dirName(path), setEditing: editing.set, readOnly }),
    [patch, onOpenPath, path, editing, readOnly]
  )

  const accepts = (e: React.DragEvent): boolean => {
    const types = [...e.dataTransfer.types]
    return types.includes('Files') || types.includes(CARD_DRAG) || types.includes(DRAG_TYPE)
  }

  const onDrop = (e: React.DragEvent): void => {
    if (readOnly || !accepts(e)) return
    e.preventDefault()
    const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const card = e.dataTransfer.getData(CARD_DRAG) as AddKind
    if (card) return add(card, null, at, true)
    // Un elemento del explorador: se incrusta (nota, imagen o archivo) sin copiarlo.
    const itemId = e.dataTransfer.getData(DRAG_TYPE)
    if (itemId) {
      void ws
        .get(itemId)
        .then(
          (item) =>
            item.kind !== 'folder' && addNodes([newFileNode(item.path, at, item.kind === 'image')])
        )
        .catch((err) => onError(errorMessage(err)))
      return
    }
    void placeFiles(
      [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean),
      at
    )
  }

  const edgeMenuFor = !selectedNodes.length && selectedEdges.length === 1 ? selectedEdges[0] : null

  return (
    <BoardContext.Provider value={actions}>
      <EditingContext.Provider value={editing}>
        <div
          ref={wrapper}
          className="ob-canvas relative size-full"
          onMouseMove={(e) => {
            pointer.current = { x: e.clientX, y: e.clientY }
          }}
          onDoubleClick={(e) => {
            if (readOnly || !(e.target as HTMLElement).classList.contains('react-flow__pane'))
              return
            addNodes([newCard(flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))], [], true)
          }}
          onDragOver={(e) => {
            if (readOnly || !accepts(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={onDrop}
        >
          <ReactFlow<BoardNode, BoardEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onSelectionDragStart={(e, picked) => onNodeDragStart(e.nativeEvent, picked[0], picked)}
            onSelectionDragStop={onNodeDragStop}
            onBeforeDelete={onBeforeDelete}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onEdgeDoubleClick={(_, edge) => {
              if (readOnly) return
              selectOnlyEdge(edge.id)
              setLabelingId(edge.id)
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault()
              const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
              menu.openAt(
                e as React.MouseEvent,
                paneItems({
                  readOnly,
                  canPaste: Boolean(clip.current),
                  snapGrid,
                  snapObjects,
                  addCard: () => add('card', null, at),
                  addNote: () => add('note', null, at),
                  addMedia: () => add('media', null, at),
                  addLink: () => setLinking(at),
                  addGroup: () => emptyGroup(at, false),
                  paste: pasteAtPointer,
                  toggleSnapGrid,
                  toggleSnapObjects,
                  toggleReadOnly,
                  fit
                })
              )
            }}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            defaultEdgeOptions={{ type: 'ob', markerEnd: ARROW }}
            connectionLineStyle={{
              stroke: 'var(--color-ob-accent)',
              strokeWidth: 'calc(2px * var(--ob-inv, 1))'
            }}
            colorMode="dark"
            deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
            selectionKeyCode={null}
            selectionOnDrag
            panOnDrag={[1, 2]}
            panOnScroll
            zoomOnDoubleClick={false}
            elevateNodesOnSelect={false}
            disableKeyboardA11y
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            snapToGrid={snapGrid && !free}
            snapGrid={[GRID, GRID]}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            fitView={!savedViewport && initial.nodes.length > 0}
            defaultViewport={savedViewport ?? undefined}
            onMoveEnd={(_, viewport) =>
              uiState.set(viewportKey, {
                x: Math.round(viewport.x),
                y: Math.round(viewport.y),
                zoom: Math.round(viewport.zoom * 10000) / 10000
              })
            }
            fitViewOptions={{ padding: FIT.padding }}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
          >
            <ZoomVar target={wrapper} />
            <SnapGuides guides={guides} />
            <Background variant={BackgroundVariant.Dots} gap={GRID} size={0.7} color="#333333" />
            {minimap && (
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                nodeColor={(n) => (n.type === 'group' ? 'transparent' : '#4a4a4a')}
                nodeStrokeColor={(n) => (n.type === 'group' ? '#5a5a5a' : 'transparent')}
                maskColor="rgb(30 30 30 / 0.75)"
                bgColor="#262626"
              />
            )}
            <SelectionMenu
              nodes={selectedNodes}
              readOnly={readOnly}
              onDelete={removeSelected}
              onColor={(color) => patchSelected(() => ({ color }))}
              onZoom={zoomToSelection}
              onGroup={groupSelection}
              onAlign={openAlignMenu}
              onBackground={openBackgroundMenu}
              onShape={(shape) =>
                patchSelected((n) =>
                  n.daylios?.kind === 'shape'
                    ? { daylios: { ...n.daylios, kind: 'shape', shape } }
                    : {}
                )
              }
            />
            {edgeMenuFor && !readOnly && (
              <Panel position="top-center">
                <EdgeMenu
                  key={edgeMenuFor.id}
                  edge={edgeMenuFor}
                  labeling={labelingId === edgeMenuFor.id}
                  onLabeling={(on) => setLabelingId(on ? edgeMenuFor.id : null)}
                  onDelete={removeSelected}
                  onArrows={(mode) =>
                    patchEdge(edgeMenuFor.id, (e) => ({
                      ...e,
                      markerEnd: mode === 'none' ? undefined : ARROW,
                      markerStart: mode === 'both' ? ARROW : undefined
                    }))
                  }
                  onLabel={(label) =>
                    patchEdge(edgeMenuFor.id, (e) => ({ ...e, label: label || undefined }))
                  }
                  onColor={(color) =>
                    patchEdge(edgeMenuFor.id, (e) => {
                      const canvas = { ...e.data!.canvas, color }
                      if (!color) delete canvas.color
                      return { ...e, data: { canvas } }
                    })
                  }
                />
              </Panel>
            )}
            <Panel position="top-right">
              <CanvasControls
                minimap={minimap}
                canUndo={!readOnly && history.canUndo}
                canRedo={!readOnly && history.canRedo}
                onZoomIn={() => void flow.zoomIn({ duration: 150 })}
                onZoomOut={() => void flow.zoomOut({ duration: 150 })}
                onReset={() => void flow.zoomTo(1, { duration: 150 })}
                onFit={fit}
                onSettings={openSettings}
                onHelp={() => setHelp(true)}
                onUndo={history.undo}
                onRedo={history.redo}
                onMinimap={() => {
                  setMinimap(!minimap)
                  prefs.set(MINIMAP_KEY, minimap ? '0' : '1')
                }}
              />
            </Panel>
            <Panel position="bottom-center">
              {readOnly ? (
                <button
                  type="button"
                  onClick={toggleReadOnly}
                  title="Salir de solo lectura"
                  className="ob-toolbar gap-2 px-3 text-[13px] text-ob-muted transition-colors hover:text-ob-text"
                >
                  <Lock size={14} />
                  Solo lectura
                </button>
              ) : (
                <CardToolbar onAdd={(kind, anchor) => add(kind, anchor)} />
              )}
            </Panel>
          </ReactFlow>
          <NotePicker
            open={picking !== null}
            noteId=""
            exclude={[]}
            notesOnly
            onClose={() => setPicking(null)}
            onPick={(target) => {
              const at = picking ?? center()
              setPicking(null)
              notesApi
                .get(target.id)
                .then((note) => note.path && addNodes([newFileNode(note.path, at, false)]))
                .catch((e) => onError(errorMessage(e)))
            }}
          />
          {linking && (
            <LinkModal
              onCancel={() => setLinking(null)}
              onAdd={(url) => {
                addNodes([newLink(url, linking)])
                setLinking(null)
              }}
            />
          )}
          {help && <ShortcutsModal onClose={() => setHelp(false)} />}
          {groupDelete && (
            <GroupDeleteModal
              count={groupDelete.count}
              onCancel={() => groupDelete.resolve('cancel')}
              onGroupOnly={() => groupDelete.resolve('group')}
              onAll={() => groupDelete.resolve('all')}
            />
          )}
          {menu.element}
        </div>
      </EditingContext.Provider>
    </BoardContext.Provider>
  )
}
