import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { colorValue, type BoardEdge } from './flow'

/** Conexión de Obsidian: curva fina gris; color del canvas si lo tiene; acento al seleccionarla. */
export const ObsidianEdge = memo(function ObsidianEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  label,
  selected,
  data
}: EdgeProps<BoardEdge>): React.JSX.Element {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  })
  const color = colorValue(data?.canvas.color)
  const stroke = selected ? 'var(--color-ob-accent)' : (color ?? '#8c8c8c')
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={18}
        style={{ stroke, strokeWidth: selected ? 3 : 2 }}
      />
      {typeof label === 'string' && label && (
        <EdgeLabelRenderer>
          <div
            className="ob-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
