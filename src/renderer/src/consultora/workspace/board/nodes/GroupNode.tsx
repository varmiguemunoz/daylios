import { memo, useEffect, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { vaultUrl } from '@shared/workspace'
import type { CanvasNode } from '@shared/canvas'
import { colorValue, type BoardNode } from '../flow'
import { useBoard, useEditing } from '../context'
import { NodeChrome } from './NodeChrome'
import { sameNode } from './sameNode'

const FIT: Record<NonNullable<CanvasNode['backgroundStyle']>, React.CSSProperties> = {
  cover: { backgroundSize: 'cover', backgroundRepeat: 'no-repeat' },
  ratio: { backgroundSize: 'contain', backgroundRepeat: 'no-repeat' },
  repeat: { backgroundSize: 'auto', backgroundRepeat: 'repeat' }
}

export const GroupNode = memo(function GroupNode({
  id,
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const { patch, setEditing, readOnly } = useBoard()
  const editing = useEditing(id)
  const color = colorValue(data.canvas.color)
  const label = data.canvas.label ?? ''
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    setDraft(label)
    setEditing(null)
  }, [editing, label, setEditing])

  const commit = (): void => {
    if (draft !== null && draft.trim() !== label) patch(id, { label: draft.trim() })
    setDraft(null)
  }

  return (
    <>
      <NodeChrome selected={selected} connectable={false} minWidth={120} minHeight={80} />
      <div
        className="ob-group"
        style={
          color
            ? { borderColor: color, background: `color-mix(in srgb, ${color} 7%, transparent)` }
            : undefined
        }
      />
      {data.canvas.background && (
        <div
          aria-hidden
          className="ob-group-bg"
          style={{
            backgroundImage: `url("${vaultUrl(data.canvas.background)}")`,
            ...FIT[data.canvas.backgroundStyle ?? 'cover']
          }}
        />
      )}
      <div
        className="ob-group-label"
        style={
          color
            ? { color, background: `color-mix(in srgb, ${color} 18%, var(--color-ob-bg))` }
            : undefined
        }
      >
        {draft !== null ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' || e.key === 'Escape') commit()
            }}
            aria-label="Nombre del grupo"
            placeholder="Grupo"
            className="nodrag w-40 bg-transparent outline-none placeholder:text-ob-faint"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              if (readOnly) return
              e.stopPropagation()
              setDraft(label)
            }}
            className={label ? '' : 'text-ob-faint'}
          >
            {label || 'Grupo'}
          </span>
        )}
      </div>
    </>
  )
}, sameNode)
