import { memo } from 'react'
import { ViewportPortal } from '@xyflow/react'
import type { Guide } from './snap'

export const SnapGuides = memo(function SnapGuides({
  guides
}: {
  guides: Guide[]
}): React.JSX.Element | null {
  if (!guides.length) return null
  return (
    <ViewportPortal>
      {guides.map((g) => (
        <div
          key={`${g.axis}-${g.at}`}
          aria-hidden
          className={`ob-guide ob-guide-${g.axis}`}
          style={
            g.axis === 'x'
              ? { left: g.at, top: g.from, height: g.to - g.from }
              : { top: g.at, left: g.from, width: g.to - g.from }
          }
        />
      ))}
    </ViewportPortal>
  )
})
