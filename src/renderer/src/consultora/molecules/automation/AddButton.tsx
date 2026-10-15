import { useState } from 'react'
import { ClipboardPaste, Plus } from 'lucide-react'

export interface AddButtonProps {
  label: string
  dragging: boolean
  reason: string | null
  selected?: boolean
  canPaste?: boolean
  onClick: () => void
  onDrop: () => void
  onDragTrack: (e: React.DragEvent) => void
}

export function AddButton({
  label,
  dragging,
  reason,
  selected,
  canPaste,
  onClick,
  onDrop,
  onDragTrack
}: AddButtonProps): React.JSX.Element {
  const [over, setOver] = useState(false)
  const valid = dragging && reason === null
  const look = !dragging
    ? selected
      ? 'border-ob-accent bg-ob-accent text-white'
      : 'border-[#4a4a4a] bg-ob-bg text-ob-muted hover:border-ob-accent hover:text-ob-link'
    : valid
      ? over
        ? 'scale-125 border-ob-accent bg-ob-accent text-white'
        : 'border-ob-accent bg-ob-accent/20 text-ob-link'
      : 'border-[#3a3a3a] bg-ob-bg text-ob-faint opacity-40'
  return (
    <button
      type="button"
      aria-label={label}
      title={dragging ? (reason ?? 'Soltar aquí') : label}
      onClick={onClick}
      onDragOver={(e) => {
        onDragTrack(e)
        if (!valid) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (valid) onDrop()
      }}
      className={`nodrag nopan grid size-6 place-items-center rounded-full border transition-[transform,background-color,border-color,opacity] duration-150 ${look}`}
    >
      {canPaste && !dragging ? (
        <ClipboardPaste size={12} aria-hidden />
      ) : (
        <Plus size={13} aria-hidden />
      )}
    </button>
  )
}
