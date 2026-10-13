import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  type NodeTypes,
  type OnBeforeDelete
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { Circle, Diamond, Square } from 'lucide-react'
import type { CanvasEdge, CanvasFile, CanvasNode, ShapeKind } from '@shared/canvas'
import { groupAround } from '@shared/canvas-groups'
import { IMAGE_EXT, dirName, extOf } from '@shared/workspace'
import { NotePicker } from '../../../components/NotePicker'
import { useContextMenu } from '../../../ui'
import { errorMessage, notesApi } from '../../../lib/api'
import { DRAG_TYPE, prefs, ws } from '../lib'
import { BoardContext } from './context'
import {
  ARROW,
  canvasOf,
  flowKind,
  fromFlow,
  newCard,
  newFileNode,
  newGroup,
  newId,
  newShape,
  toFlowNode,
  type BoardEdge,
  type BoardNode
} from './flow'
import { useHistory } from './history'
import {
  carry,
  copySelection,
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

const NODE_TYPES: NodeTypes = {
  card: CardNode,
  text: TextNode,
  shape: ShapeNode,
  group: GroupNode,
  image: ImageNode,
  note: NoteNode,
  file: FileNode,
  link: LinkNode
}
const EDGE_TYPES: EdgeTypes = { ob: ObsidianEdge }

const MINIMAP_KEY = 'ws.board.minimap'
const GRID = 20
const FIT = { padding: 0.15, duration: 200 }
const OPPOSITE: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
}
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

interface BoardCanvasProps {
  /** Ruta del board en la bóveda (las imágenes del texto se resuelven desde su carpeta). */
  path: string
  /** Carpeta del board: ahí van los archivos que se suben. */
  folderId: string | null
  initial: { nodes: BoardNode[]; edges: BoardEdge[] }
  /** Campos del archivo que no son nodos ni conexiones (se conservan al guardar). */
  base: CanvasFile
  /** Algo cambió. El padre guarda más tarde pidiendo `snapshot`; así no se serializa en cada fotograma. */
  onDirty: () => void
  /** El board escribe aquí cómo leer su estado actual como canvas. */
  snapshot: React.RefObject<(() => CanvasFile) | null>
  onOpenPath: (path: string) => void
  onError: (message: string | null) => void
}

const clean = (nodes: BoardNode[]): BoardNode[] =>
  nodes.map((n) => ({ ...n, selected: false, dragging: false }))

/** Cambios que no tocan el archivo: selección y medidas que calcula React Flow al pintar. */
const cosmetic = (c: NodeChange<BoardNode>): boolean =>
  c.type === 'select' || (c.type === 'dimensions' && c.resizing === undefined && !c.setAttributes)

/** Conexión nueva con flecha al final (como Obsidian). */
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

/** Lienzo del board al estilo Obsidian (React Flow controlado). */
export function BoardCanvas({
  path,
  folderId,
  initial,
  base,
  onDirty,
  snapshot,
  onOpenPath,
  onError
}: BoardCanvasProps): React.JSX.Element {
  const [nodes, setNodes] = useState<BoardNode[]>(initial.nodes)
  const [edges, setEdges] = useState<BoardEdge[]>(initial.edges)
  const [editingId, setEditing] = useState<string | null>(null)
  const [picking, setPicking] = useState<{ x: number; y: number } | null>(null)
  const [minimap, setMinimap] = useState(() => prefs.get(MINIMAP_KEY) === '1')
  const [free, setFree] = useState(false) // ⌥ pulsado: colocar sin rejilla
  const [groupDelete, setGroupDelete] = useState<{
    count: number
    resolve: (choice: 'cancel' | 'group' | 'all') => void
  } | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const clip = useRef<Clip | null>(null)
  const riders = useRef(new Map<string, { x: number; y: number }>())
  const dragStart = useRef({ x: 0, y: 0 })
  const resizing = useRef(false)
  const flow = useReactFlow<BoardNode, BoardEdge>()
  const menu = useContextMenu()

  const latest = useRef({ nodes, edges })
  useLayoutEffect(() => {
    latest.current = { nodes, edges }
  })

  // El padre pide el canvas solo cuando va a guardar.
  useLayoutEffect(() => {
    snapshot.current = () => fromFlow(latest.current.nodes, latest.current.edges, base)
  }, [snapshot, base])

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

  // ---- cambios de React Flow ----

  const onNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      if (changes.some((c) => c.type === 'remove')) checkpoint()
      const resize = changes.find((c) => c.type === 'dimensions' && c.resizing)
      if (resize && !resizing.current) checkpoint()
      const resized = resizing.current && !resize
      resizing.current = Boolean(resize)
      setNodes((ns) => {
        const next = applyNodeChanges(changes, ns)
        return resized ? restack(next) : next
      })
      if (!changes.every(cosmetic)) onDirty()
    },
    [checkpoint, onDirty]
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

  /** Añade nodos de canvas (quedan seleccionados). `edit`: el primero entra a escribir. */
  const addNodes = useCallback(
    (list: CanvasNode[], extraEdges: BoardEdge[] = [], edit = false) => {
      if (!list.length) return
      checkpoint()
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        ...list.map((n) => ({ ...toFlowNode(n), selected: true }))
      ])
      if (extraEdges.length) setEdges((es) => [...es, ...extraEdges])
      if (edit) setEditing(list[0].id)
      onDirty()
    },
    [checkpoint, onDirty]
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

  const onNodeDragStart = useCallback(
    (_: unknown, node: BoardNode, dragged: BoardNode[]) => {
      checkpoint()
      dragStart.current = { ...node.position }
      riders.current = passengers(latest.current.nodes, new Set(dragged.map((n) => n.id)))
    },
    [checkpoint]
  )

  const onNodeDrag = useCallback((_: unknown, node: BoardNode) => {
    if (!riders.current.size) return
    const delta = {
      x: node.position.x - dragStart.current.x,
      y: node.position.y - dragStart.current.y
    }
    setNodes((ns) => carry(ns, riders.current, delta))
  }, [])

  const onNodeDragStop = useCallback(() => {
    riders.current = new Map()
    onDirty()
  }, [onDirty])

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

  const center = (): { x: number; y: number } => {
    const box = wrapper.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }

  const placeFiles = async (paths: string[], at: { x: number; y: number }): Promise<void> => {
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

  /** `dropped`: viene de arrastrar desde la barra, así que va justo en `at`. */
  const add = (kind: AddKind, anchor: HTMLElement | null, at = center(), dropped = false): void => {
    if (kind === 'card') addNodes([newCard(at)], [], true)
    else if (kind === 'note') setPicking(at)
    else if (kind === 'media') void ws.pickFiles().then((paths) => placeFiles(paths, at))
    else if (kind === 'group') {
      if (!dropped && latest.current.nodes.some((n) => n.selected)) groupSelection()
      else
        addNodes(
          [
            newGroup({
              x: Math.round(at.x - 200),
              y: Math.round(at.y - 150),
              width: 400,
              height: 300
            })
          ],
          [],
          true
        )
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

  const paste = (offset = 40): void => {
    if (!clip.current) return
    const pasted = pasteClip(clip.current, { x: offset, y: offset })
    checkpoint()
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...pasted.nodes])
    setEdges((es) => [...es.map((e) => ({ ...e, selected: false })), ...pasted.edges])
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

  /** Mueve lo seleccionado con las flechas (los grupos con su contenido). */
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

  const zoomToSelection = (): void => {
    const picked = latest.current.nodes.filter((n) => n.selected)
    if (picked.length) void flow.fitView({ ...FIT, nodes: picked.map((n) => ({ id: n.id })) })
  }

  // ---- teclado (no mientras se escribe) ----

  useEffect(() => {
    const typing = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      return Boolean(
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      )
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') setFree(e.type === 'keydown')
      if (e.type !== 'keydown' || typing(e.target) || document.querySelector('[role="dialog"]'))
        return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const step = e.shiftKey ? 10 : 1
      const run = (fn: () => void): void => {
        e.preventDefault()
        fn()
      }
      if (e.key.startsWith('Arrow') && !mod) {
        const [dx, dy] = ARROWS[e.key] ?? [0, 0]
        return run(() => nudge(dx * step, dy * step))
      }
      if (e.key === 'Escape')
        return run(() =>
          setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
        )
      if (e.shiftKey && e.code === 'Digit1') return run(() => void flow.fitView(FIT))
      if (e.shiftKey && e.code === 'Digit2') return run(zoomToSelection)
      if (!mod) return
      if (key === 'z') return run(e.shiftKey ? history.redo : history.undo)
      if (key === 'a') return run(() => setNodes((ns) => ns.map((n) => ({ ...n, selected: true }))))
      if (key === 'g') return run(groupSelection)
      if (key === 'c') {
        clip.current = copySelection(latest.current.nodes, latest.current.edges) ?? clip.current
        return
      }
      if (key === 'x') {
        clip.current = copySelection(latest.current.nodes, latest.current.edges) ?? clip.current
        return run(removeSelected)
      }
      if (key === 'v' && clip.current) return run(() => paste())
      if (key === 'd') {
        const copy = copySelection(latest.current.nodes, latest.current.edges)
        if (!copy) return
        return run(() => {
          clip.current = copy
          paste(GRID * 2)
        })
      }
      if (key === '=' || key === '+') return run(() => void flow.zoomIn({ duration: 150 }))
      if (key === '-') return run(() => void flow.zoomOut({ duration: 150 }))
      if (key === '0') return run(() => void flow.zoomTo(1, { duration: 150 }))
    }
    const reset = (): void => setFree(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', reset)
    }
  })

  const actions = useMemo(
    () => ({ patch, openPath: onOpenPath, base: dirName(path), editingId, setEditing }),
    [patch, onOpenPath, path, editingId]
  )

  const accepts = (e: React.DragEvent): boolean => {
    const types = [...e.dataTransfer.types]
    return types.includes('Files') || types.includes(CARD_DRAG) || types.includes(DRAG_TYPE)
  }

  const onDrop = (e: React.DragEvent): void => {
    if (!accepts(e)) return
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

  return (
    <BoardContext.Provider value={actions}>
      <div
        ref={wrapper}
        className="ob-canvas relative size-full"
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return
          addNodes([newCard(flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))], [], true)
        }}
        onDragOver={(e) => {
          if (!accepts(e)) return
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
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onBeforeDelete={onBeforeDelete}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
            menu.openAt(e as React.MouseEvent, [
              { label: 'Añadir tarjeta', onSelect: () => add('card', null, at) },
              { label: 'Añadir nota de la bóveda', onSelect: () => add('note', null, at) },
              { label: 'Añadir imagen o archivo', onSelect: () => add('media', null, at) },
              {
                label: 'Grupo vacío',
                onSelect: () =>
                  addNodes(
                    [
                      newGroup({
                        x: Math.round(at.x),
                        y: Math.round(at.y),
                        width: 400,
                        height: 300
                      })
                    ],
                    [],
                    true
                  )
              },
              null,
              ...(clip.current ? [{ label: 'Pegar', onSelect: () => paste() }] : []),
              { label: 'Encuadrar todo', onSelect: () => void flow.fitView(FIT) }
            ])
          }}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          defaultEdgeOptions={{ type: 'ob', markerEnd: ARROW }}
          connectionLineStyle={{ stroke: 'var(--color-ob-accent)', strokeWidth: 2 }}
          colorMode="dark"
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
          selectionKeyCode={null}
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnDoubleClick={false}
          elevateNodesOnSelect={false}
          disableKeyboardA11y
          snapToGrid={!free}
          snapGrid={[GRID, GRID]}
          minZoom={0.1}
          maxZoom={3}
          fitView={initial.nodes.length > 0}
          fitViewOptions={{ padding: 0.15 }}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} color="#3a3a3a" />
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
            onDelete={removeSelected}
            onColor={(color) => patchSelected(() => ({ color }))}
            onZoom={zoomToSelection}
            onGroup={groupSelection}
            onShape={(shape) =>
              patchSelected((n) =>
                n.daylios?.kind === 'shape'
                  ? { daylios: { ...n.daylios, kind: 'shape', shape } }
                  : {}
              )
            }
          />
          {!selectedNodes.length && selectedEdges.length === 1 && (
            <Panel position="top-center">
              <EdgeMenu
                key={selectedEdges[0].id}
                edge={selectedEdges[0]}
                onDelete={removeSelected}
                onArrows={(mode) =>
                  patchEdge(selectedEdges[0].id, (e) => ({
                    ...e,
                    markerEnd: mode === 'none' ? undefined : ARROW,
                    markerStart: mode === 'both' ? ARROW : undefined
                  }))
                }
                onLabel={(label) =>
                  patchEdge(selectedEdges[0].id, (e) => ({ ...e, label: label || undefined }))
                }
                onColor={(color) =>
                  patchEdge(selectedEdges[0].id, (e) => {
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
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onZoomIn={() => void flow.zoomIn({ duration: 150 })}
              onZoomOut={() => void flow.zoomOut({ duration: 150 })}
              onFit={() => void flow.fitView(FIT)}
              onUndo={history.undo}
              onRedo={history.redo}
              onMinimap={() => {
                setMinimap(!minimap)
                prefs.set(MINIMAP_KEY, minimap ? '0' : '1')
              }}
            />
          </Panel>
          <Panel position="bottom-center">
            <CardToolbar onAdd={(kind, anchor) => add(kind, anchor)} />
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
    </BoardContext.Provider>
  )
}
