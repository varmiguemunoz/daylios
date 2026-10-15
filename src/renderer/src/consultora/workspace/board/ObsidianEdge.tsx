import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { colorValue, type BoardEdge } from './flow'

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
  const stroke = selected ? 'var(--color-ob-accent)' : (color ?? 'var(--ob-canvas-color)')
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={24}
        style={{ stroke, strokeWidth: `calc(${selected ? 3 : 2}px * var(--ob-inv, 1))` }}
      />
      {typeof label === 'string' && label && (
        <EdgeLabelRenderer>
          <div
            className="ob-edge-label nodrag nopan"
            style={{
              transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%) scale(var(--ob-inv, 1))`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
