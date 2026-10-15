import { useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import {
  branchesOf,
  clone,
  describeNode,
  describeTrigger,
  LAYOUT,
  layout,
  nodeSpec,
  paste,
  portsOf,
  PORT_LABELS,
  removeNode,
  removeSubtree,
  ROOT,
  sameSlot,
  triggerSpec,
  type Definition,
  type Fragment,
  type Slot
} from '@shared/automations'
import { useContextMenu } from '../../../ui'
import { useUiState } from '../../../lib/ui-state'
import { CanvasControls } from '../../workspace/board/CanvasControls'
import { NodeCard } from '../../molecules/automation/NodeCard'
import { AddTriggerCard, TriggerCard } from '../../molecules/automation/TriggerCard'
import { AddButton } from '../../molecules/automation/AddButton'
import { NODE_DRAG } from '../../hooks/useTreeDrag'
import { useEditor } from './context'

type StepData = { id: string }
type TriggerData = { id: string }
type SlotData = { slot: Slot }

type FlowNode =
  | Node<StepData, 'step'>
  | Node<TriggerData, 'trigger'>
  | Node<Record<string, never>, 'addTrigger'>
  | Node<SlotData, 'slot'>

const SLOT = 24
const NOOP = (): void => undefined
const GROUP_LABEL: Record<string, string> = {
  contacto: 'Contacto',
  pipeline: 'Pipeline',
  clientes: 'Clientes',
  productividad: 'Productividad',
  tiempo: 'Tiempo'
}
const SIZE = { ...LAYOUT, rowGap: 112 }
const FIT = { padding: 0.2, minZoom: 0.85, maxZoom: 1, duration: 200 }
const HIDDEN = '!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent'

const slotId = (slot: Slot): string => `slot:${slot.parent}:${slot.port}`
const nodeId = (id: string): string => `node:${id}`
const triggerId = (id: string): string => `trigger:${id}`

function Handles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className={HIDDEN} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className={HIDDEN} />
    </>
  )
}

function StepNode({ data }: NodeProps<Node<StepData, 'step'>>): React.JSX.Element | null {
  const editor = useEditor()
  const menu = useContextMenu()
  const node = editor.def.nodes[data.id]
  if (!node) return null
  const spec = nodeSpec(node.type)
  const stat = editor.stats?.[node.id]
  const remove = (all: boolean): void => {
    editor.select(null)
    editor.notify(editor.apply((d) => (all ? removeSubtree(d, node.id) : removeNode(d, node.id))))
  }
  return (
    <>
      <Handles />
      <NodeCard
        icon={spec?.icon ?? 'Circle'}
        kind={spec?.label ?? node.type}
        name={node.name || spec?.label || node.type}
        sentence={describeNode(node, editor.names)}
        issues={editor.issues[node.id] ?? []}
        destructive={spec?.destructive}
        pill={node.type === 'wait'}
        selected={editor.selection?.kind === 'node' && editor.selection.id === node.id}
        highlighted={editor.path?.has(node.id)}
        dimmed={
          Boolean(editor.path && !editor.path.has(node.id)) ||
          (editor.drag.item?.kind === 'move' && editor.drag.item.id === node.id)
        }
        counts={
          editor.stats
            ? {
                passed: (stat?.ok ?? 0) + (stat?.skipped ?? 0),
                waiting: stat?.waitingHere ?? 0,
                failed: stat?.failedHere ?? 0
              }
            : null
        }
        onClick={() => editor.select({ kind: 'node', id: node.id })}
        onDragStart={(e) => editor.drag.start({ kind: 'move', id: node.id }, e)}
        onDragEnd={editor.drag.end}
        onContextMenu={(e) => {
          e.preventDefault()
          menu.openAt(e, [
            {
              label: 'Copiar paso',
              onSelect: () => editor.setClipboard(clone(editor.def, node.id, 'node'))
            },
            {
              label: 'Copiar con lo que cuelga',
              onSelect: () => editor.setClipboard(clone(editor.def, node.id, 'subtree'))
            },
            null,
            {
              label: portsOf(node).length > 1 ? 'Borrar…' : 'Borrar paso',
              danger: true,
              onSelect: () =>
                portsOf(node).length > 1
                  ? editor.select({ kind: 'node', id: node.id })
                  : remove(false)
            },
            { label: 'Borrar con lo que cuelga', danger: true, onSelect: () => remove(true) }
          ])
        }}
      />
      {menu.element}
    </>
  )
}

function TriggerNode({ data }: NodeProps<Node<TriggerData, 'trigger'>>): React.JSX.Element | null {
  const editor = useEditor()
  const trigger = editor.def.triggers.find((t) => t.id === data.id)
  if (!trigger) return null
  const spec = triggerSpec(trigger.type)
  return (
    <>
      <Handles />
      <TriggerCard
        icon={spec?.icon ?? 'Zap'}
        label={`Trigger · ${GROUP_LABEL[spec?.group ?? ''] ?? ''}`}
        sentence={describeTrigger(trigger, editor.names)}
        filters={(trigger.conditions ?? []).reduce((n, g) => n + g.conditions.length, 0)}
        issues={editor.issues[trigger.id] ?? []}
        selected={editor.selection?.kind === 'trigger' && editor.selection.id === trigger.id}
        onClick={() => editor.select({ kind: 'trigger', id: trigger.id })}
      />
    </>
  )
}

function AddTriggerNode(): React.JSX.Element {
  const editor = useEditor()
  return (
    <AddTriggerCard
      selected={editor.selection?.kind === 'add-trigger'}
      onClick={() => editor.select({ kind: 'add-trigger' })}
    />
  )
}

function SlotNode({ data }: NodeProps<Node<SlotData, 'slot'>>): React.JSX.Element {
  const editor = useEditor()
  const { slot } = data
  const dragging = editor.drag.item !== null
  const selected = editor.selection?.kind === 'slot' && sameSlot(editor.selection.slot, slot)
  return (
    <>
      <Handles />
      <AddButton
        label="Añadir paso aquí"
        dragging={dragging}
        reason={dragging ? editor.drag.reason(slot) : null}
        selected={selected}
        canPaste={Boolean(editor.clipboard)}
        onClick={() => editor.select({ kind: 'slot', slot })}
        onDragTrack={editor.drag.track}
        onDrop={() => editor.notify(editor.drag.drop(slot, editor.apply))}
      />
    </>
  )
}

const NODE_TYPES = {
  step: StepNode,
  trigger: TriggerNode,
  addTrigger: AddTriggerNode,
  slot: SlotNode
}

function edgeLabel(def: Definition, parent: string, port: string): string | undefined {
  const node = def.nodes[parent]
  if (!node) return undefined
  if (node.type === 'if_else') {
    const branch = branchesOf(node.params).find((b) => b.id === port)
    return branch?.name || PORT_LABELS[port] || undefined
  }
  return PORT_LABELS[port] || undefined
}

function buildFlow(
  def: Definition,
  path: Set<string> | null
): { nodes: FlowNode[]; edges: Edge[] } {
  const box = layout(def, SIZE)
  const size = { width: SIZE.nodeWidth, height: SIZE.nodeHeight }
  const nodes: FlowNode[] = []
  const edges: Edge[] = []
  const lit = (a: string | null, b: string | null): boolean =>
    Boolean(path && (a === null || path.has(a)) && (b === null || path.has(b)))
  const edge = (id: string, source: string, target: string, on: boolean, label?: string): Edge => ({
    id,
    source,
    target,
    type: 'smoothstep',
    label,
    selectable: false,
    focusable: false,
    className: on ? 'ob-auto-edge is-lit' : 'ob-auto-edge',
    labelBgPadding: [6, 2],
    labelBgBorderRadius: 4
  })

  def.triggers.forEach((t, i) => {
    nodes.push({
      id: triggerId(t.id),
      type: 'trigger',
      position: box.triggers[i],
      data: { id: t.id },
      ...size
    })
    edges.push(
      edge(`e:${t.id}`, triggerId(t.id), slotId({ parent: ROOT, port: ROOT }), Boolean(path))
    )
  })
  nodes.push({ id: 'add-trigger', type: 'addTrigger', position: box.addTrigger, data: {}, ...size })

  for (const [id, point] of Object.entries(box.nodes))
    nodes.push({ id: nodeId(id), type: 'step', position: point, data: { id }, ...size })

  for (const { slot, x, y } of box.slots) {
    nodes.push({
      id: slotId(slot),
      type: 'slot',
      position: { x: x - SLOT / 2, y: y - SLOT / 2 },
      data: { slot },
      width: SLOT,
      height: SLOT
    })
    const parentNode = slot.parent === ROOT ? null : slot.parent
    const child =
      slot.parent === ROOT ? def.root : (def.nodes[slot.parent]?.next[slot.port] ?? null)
    if (parentNode)
      edges.push(
        edge(
          `in:${slotId(slot)}`,
          nodeId(parentNode),
          slotId(slot),
          lit(parentNode, child),
          edgeLabel(def, parentNode, slot.port)
        )
      )
    if (child && def.nodes[child])
      edges.push(edge(`out:${slotId(slot)}`, slotId(slot), nodeId(child), lit(parentNode, child)))
  }
  return { nodes, edges }
}

function Flow({
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}): React.JSX.Element {
  const editor = useEditor()
  const flow = useReactFlow()
  const [minimap, setMinimap] = useUiState('automations.minimap', false)
  const { nodes, edges } = useMemo(
    () => buildFlow(editor.def, editor.path),
    [editor.def, editor.path]
  )
  const fitted = useRef(false)

  const selected = editor.selection
  useEffect(() => {
    if (!selected || selected.kind === 'add-trigger') return
    const id =
      selected.kind === 'node'
        ? nodeId(selected.id)
        : selected.kind === 'trigger'
          ? triggerId(selected.id)
          : slotId(selected.slot)
    const target = flow.getNode(id)
    if (!target) return
    const w = target.width ?? LAYOUT.nodeWidth
    const h = target.height ?? LAYOUT.nodeHeight
    void flow.setCenter(target.position.x + w / 2, target.position.y + h / 2, {
      zoom: Math.max(flow.getZoom(), 0.85),
      duration: 250
    })
  }, [selected, flow])

  useEffect(() => {
    if (fitted.current) return
    fitted.current = true
    requestAnimationFrame(() => void flow.fitView(FIT))
  }, [flow])

  return (
    <ReactFlow<FlowNode, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnDoubleClick={false}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      onNodeClick={NOOP}
      onPaneClick={() => editor.select(null)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(NODE_DRAG)) e.dataTransfer.dropEffect = 'move'
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#3a3a3a" />
      {minimap && (
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) => (n.type === 'slot' ? 'transparent' : '#4a4a4a')}
          maskColor="rgb(30 30 30 / 0.75)"
          bgColor="#262626"
        />
      )}
      <Panel position="top-right">
        <CanvasControls
          minimap={minimap}
          canUndo={canUndo}
          canRedo={canRedo}
          onZoomIn={() => void flow.zoomIn({ duration: 150 })}
          onZoomOut={() => void flow.zoomOut({ duration: 150 })}
          onFit={() => void flow.fitView(FIT)}
          onUndo={onUndo}
          onRedo={onRedo}
          onMinimap={() => setMinimap(!minimap)}
        />
      </Panel>
      {editor.drag.item?.kind === 'move' && (
        <Panel position="top-center">
          <p className="rounded-[6px] border border-ob-border bg-ob-alt px-3 py-1.5 text-[12px] text-ob-muted">
            {editor.drag.mode === 'subtree'
              ? 'Moviendo el paso con lo que cuelga. Suelta ⌥ para mover solo el paso.'
              : 'Moviendo solo el paso. Mantén ⌥ para llevar lo que cuelga.'}
          </p>
        </Panel>
      )}
    </ReactFlow>
  )
}

export function Canvas(props: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}): React.JSX.Element {
  return (
    <div className="ob-canvas ob-auto relative size-full">
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </div>
  )
}

export function pasteAt(def: Definition, slot: Slot, fragment: Fragment): Definition {
  const holder: Definition = { ...def, root: fragment.root, nodes: fragment.nodes }
  return paste(def, slot, clone(holder, fragment.root, 'subtree'))
}
