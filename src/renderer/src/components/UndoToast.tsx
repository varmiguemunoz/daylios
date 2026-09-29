import { useEffect } from 'react'
import type { Undo } from '../lib/useDay'

interface UndoToastProps {
  undo: Undo | null
  onUndo: () => void
  onDone: () => void
}

/** Borrar sin confirmar; deshacer durante 6 s (o ⌘Z). */
export function UndoToast({ undo, onUndo, onDone }: UndoToastProps): React.JSX.Element | null {
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(onDone, 6000)
    return () => window.clearTimeout(t)
  }, [undo, onDone])

  if (!undo) return null

  return (
    <div
      key={undo.id}
      role="status"
      className="toast-in absolute inset-x-6 bottom-[76px] flex h-12 items-center justify-between rounded-full bg-surface-raised pr-1.5 pl-5 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)]"
    >
      <span className="text-caption font-semibold">{undo.message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="h-9 rounded-full px-4 text-caption font-extrabold text-apricot hover:bg-apricot/10"
      >
        Deshacer <span className="font-semibold text-milk-soft">⌘Z</span>
      </button>
    </div>
  )
}
