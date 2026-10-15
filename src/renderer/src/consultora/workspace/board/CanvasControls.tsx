import { useStore } from '@xyflow/react'
import {
  CircleHelp,
  Map as MapIcon,
  Maximize,
  Minus,
  Plus,
  Redo2,
  RotateCw,
  Settings,
  Undo2
} from 'lucide-react'
import { kbd } from '../../../lib/platform'

interface CanvasControlsProps {
  minimap: boolean
  canUndo: boolean
  canRedo: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onReset?: () => void
  onFit: () => void
  onSettings?: (anchor: HTMLElement) => void
  onHelp?: () => void
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
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
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

export function CanvasControls(p: CanvasControlsProps): React.JSX.Element {
  // Solo esta pieza se vuelve a pintar al hacer zoom.
  const zoom = useStore((s) => s.transform[2])
  return (
    <div className="flex flex-col gap-2">
      {p.onSettings && (
        <div className="ob-controls">
          <Control label="Ajustes del board" onClick={(e) => p.onSettings?.(e.currentTarget)}>
            <Settings size={15} />
          </Control>
        </div>
      )}
      <div className="ob-controls">
        <Control label={kbd('Acercar · ⌘=')} onClick={p.onZoomIn}>
          <Plus size={16} />
        </Control>
        <span className="py-0.5 text-center text-[11px] text-ob-faint tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        {p.onReset && (
          <Control label={kbd('Zoom al 100 % · ⌘0')} onClick={p.onReset}>
            <RotateCw size={15} />
          </Control>
        )}
        <Control label={kbd('Encuadrar todo · ⇧1')} onClick={p.onFit}>
          <Maximize size={15} />
        </Control>
        <Control label={kbd('Alejar · ⌘−')} onClick={p.onZoomOut}>
          <Minus size={16} />
        </Control>
      </div>
      <div className="ob-controls">
        <Control label={kbd('Deshacer · ⌘Z')} onClick={p.onUndo} disabled={!p.canUndo}>
          <Undo2 size={16} />
        </Control>
        <Control label={kbd('Rehacer · ⇧⌘Z')} onClick={p.onRedo} disabled={!p.canRedo}>
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
        {p.onHelp && (
          <Control label="Atajos del board" onClick={p.onHelp}>
            <CircleHelp size={15} />
          </Control>
        )}
      </div>
    </div>
  )
}
