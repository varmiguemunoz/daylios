import { memo } from 'react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import { useBoard } from '../context'

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left }
] as const

export const NodeChrome = memo(function NodeChrome({
  selected,
  connectable = true,
  minWidth = 60,
  minHeight = 40
}: {
  selected: boolean
  connectable?: boolean
  minWidth?: number
  minHeight?: number
}): React.JSX.Element {
  const { readOnly } = useBoard()
  return (
    <>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={minWidth}
        minHeight={minHeight}
        lineClassName="ob-resize-line"
        handleClassName="ob-resize-handle"
      />
      {connectable &&
        !readOnly &&
        SIDES.map((s) => (
          <Handle key={s.id} id={s.id} type="source" position={s.position} className="ob-handle" />
        ))}
    </>
  )
})
