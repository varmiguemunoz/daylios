import { useStore } from '@xyflow/react'
import { Map as MapIcon, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react'

interface CanvasControlsProps {
  minimap: boolean
  canUndo: boolean
  canRedo: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onUndo: () => void
  onRedo: () => void
  onMinimap: () => void
}

function Control({
  label,
  onClick,
  disabled,
  pressed,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="ob-tool"
    >
      {children}
    </button>
  )
}

/** Columna de controles arriba a la derecha, como Obsidian: zoom, encuadrar, deshacer y minimapa. */
export function CanvasControls(p: CanvasControlsProps): React.JSX.Element {
  // Solo esta pieza se vuelve a pintar al hacer zoom.
  const zoom = useStore((s) => s.transform[2])
  return (
    <div className="flex flex-col gap-2">
      <div className="ob-controls">
        <Control label="Acercar · ⌘=" onClick={p.onZoomIn}>
          <Plus size={16} />
        </Control>
        <span className="py-0.5 text-center text-[11px] text-ob-faint tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Control label="Alejar · ⌘−" onClick={p.onZoomOut}>
          <Minus size={16} />
        </Control>
        <Control label="Encuadrar todo · ⇧1" onClick={p.onFit}>
          <Maximize size={15} />
        </Control>
      </div>
      <div className="ob-controls">
        <Control label="Deshacer · ⌘Z" onClick={p.onUndo} disabled={!p.canUndo}>
          <Undo2 size={16} />
        </Control>
        <Control label="Rehacer · ⇧⌘Z" onClick={p.onRedo} disabled={!p.canRedo}>
          <Redo2 size={16} />
        </Control>
      </div>
      <div className="ob-controls">
        <Control
          label={p.minimap ? 'Ocultar minimapa' : 'Mostrar minimapa'}
          onClick={p.onMinimap}
          pressed={p.minimap}
        >
          <MapIcon size={15} />
        </Control>
      </div>
    </div>
  )
}
