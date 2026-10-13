import { memo, useEffect, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { colorValue, type BoardNode } from '../flow'
import { useBoard } from '../context'
import { NodeChrome } from './NodeChrome'

/**
 * Grupo de Obsidian: rectángulo con tinte y rótulo encima. Lo que cabe dentro se mueve con él
 * (lo resuelve BoardCanvas al arrastrar). Doble clic en el rótulo lo edita.
 */
export const GroupNode = memo(function GroupNode({
  id,
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const { patch, editingId, setEditing } = useBoard()
  const color = colorValue(data.canvas.color)
  const label = data.canvas.label ?? ''
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    if (editingId !== id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- grupo recién creado: nombrarlo
    setDraft(label)
    setEditing(null)
  }, [editingId, id, label, setEditing])

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
})
