import { useState } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import {
  ArrowLeftRight,
  ArrowRight,
  Circle,
  Diamond,
  Group,
  Minus,
  Palette,
  Scan,
  Square,
  Trash2,
  Type
} from 'lucide-react'
import type { ShapeKind } from '@shared/canvas'
import { COLORS, type BoardEdge, type BoardNode } from './flow'

function Tool({
  label,
  onClick,
  active,
  danger,
  children
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`ob-tool ${danger ? 'hover:!text-[#fb464c]' : ''} ${active ? '!text-ob-accent' : ''}`}
    >
      {children}
    </button>
  )
}

function ColorRow({
  current,
  onColor
}: {
  current?: string
  onColor: (color: string | undefined) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-1.5">
      <button
        type="button"
        aria-label="Sin color"
        title="Sin color"
        onClick={() => onColor(undefined)}
        className={`size-5 rounded-full border border-ob-faint bg-ob-bg ${!current ? 'ring-2 ring-ob-text ring-offset-1 ring-offset-ob-alt' : ''}`}
      />
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={c.label}
          title={c.label}
          onClick={() => onColor(c.id)}
          className={`size-5 rounded-full ${current === c.id ? 'ring-2 ring-ob-text ring-offset-1 ring-offset-ob-alt' : ''}`}
          style={{ background: c.value }}
        />
      ))}
    </div>
  )
}

const SHAPES: { shape: ShapeKind; label: string; Icon: typeof Square }[] = [
  { shape: 'rect', label: 'Rectángulo', Icon: Square },
  { shape: 'ellipse', label: 'Elipse', Icon: Circle },
  { shape: 'diamond', label: 'Rombo', Icon: Diamond }
]

interface SelectionMenuProps {
  nodes: BoardNode[]
  onDelete: () => void
  onColor: (color: string | undefined) => void
  onZoom: () => void
  onGroup: () => void
  onShape: (shape: ShapeKind) => void
}

export function SelectionMenu({
  nodes,
  onDelete,
  onColor,
  onZoom,
  onGroup,
  onShape
}: SelectionMenuProps): React.JSX.Element | null {
  const [palette, setPalette] = useState(false)
  const dragging = nodes.some((n) => n.dragging)
  if (!nodes.length || dragging) return null
  const colors = new Set(nodes.map((n) => n.data.canvas.color))
  const current = colors.size === 1 ? [...colors][0] : undefined
  const allShapes = nodes.every((n) => n.type === 'shape')
  const shape =
    allShapes && nodes.length === 1 ? (nodes[0].data.canvas.daylios?.shape ?? 'rect') : null
  const canGroup = nodes.length > 1 || nodes[0].type !== 'group'

  return (
    <NodeToolbar nodeId={nodes.map((n) => n.id)} isVisible position={Position.Top} offset={14}>
      <div role="toolbar" aria-label="Selección" className="ob-menu">
        <Tool label="Borrar · ⌫" onClick={onDelete} danger>
          <Trash2 size={16} />
        </Tool>
        <Tool label="Color" onClick={() => setPalette(!palette)} active={palette}>
          <Palette size={16} />
        </Tool>
        {palette && <ColorRow current={current} onColor={onColor} />}
        <Tool label="Encuadrar selección · ⇧2" onClick={onZoom}>
          <Scan size={16} />
        </Tool>
        {canGroup && (
          <Tool label="Crear grupo · ⌘G" onClick={onGroup}>
            <Group size={16} />
          </Tool>
        )}
        {allShapes &&
          SHAPES.map(({ shape: s, label, Icon }) => (
            <Tool key={s} label={label} onClick={() => onShape(s)} active={shape === s}>
              <Icon size={15} />
            </Tool>
          ))}
      </div>
    </NodeToolbar>
  )
}

export type ArrowMode = 'none' | 'end' | 'both'

export const arrowMode = (e: BoardEdge): ArrowMode =>
  e.markerStart ? 'both' : e.markerEnd ? 'end' : 'none'

interface EdgeMenuProps {
  edge: BoardEdge
  onArrows: (mode: ArrowMode) => void
  onLabel: (label: string) => void
  onColor: (color: string | undefined) => void
  onDelete: () => void
}

export function EdgeMenu({
  edge,
  onArrows,
  onLabel,
  onColor,
  onDelete
}: EdgeMenuProps): React.JSX.Element {
  const [labeling, setLabeling] = useState(false)
  const [palette, setPalette] = useState(false)
  const label = typeof edge.label === 'string' ? edge.label : ''
  const mode = arrowMode(edge)
  return (
    <div role="toolbar" aria-label="Conexión" className="ob-menu">
      <Tool label="Borrar · ⌫" onClick={onDelete} danger>
        <Trash2 size={16} />
      </Tool>
      <Tool label="Color" onClick={() => setPalette(!palette)} active={palette}>
        <Palette size={16} />
      </Tool>
      {palette && <ColorRow current={edge.data?.canvas.color} onColor={onColor} />}
      <Tool label="Sin puntas" onClick={() => onArrows('none')} active={mode === 'none'}>
        <Minus size={16} />
      </Tool>
      <Tool label="Punta al final" onClick={() => onArrows('end')} active={mode === 'end'}>
        <ArrowRight size={16} />
      </Tool>
      <Tool
        label="Puntas en los dos lados"
        onClick={() => onArrows('both')}
        active={mode === 'both'}
      >
        <ArrowLeftRight size={16} />
      </Tool>
      {labeling ? (
        <input
          autoFocus
          defaultValue={label}
          aria-label="Rótulo de la conexión"
          placeholder="Rótulo"
          onBlur={(e) => {
            onLabel(e.target.value.trim())
            setLabeling(false)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
          }}
          className="h-7 w-36 rounded-[4px] bg-ob-bg px-2 text-[13px] text-ob-text outline-none"
        />
      ) : (
        <Tool label="Rótulo" onClick={() => setLabeling(true)}>
          <Type size={16} />
        </Tool>
      )}
    </div>
  )
}
