import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../organisms/overlay'

export interface MenuAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** rose: acciones que borran. */
  danger?: boolean
  disabled?: boolean
}

/** `null` en la lista = separador. */
export type MenuEntry = MenuAction | null

interface MenuState {
  x: number
  y: number
  items: MenuEntry[]
}

/**
 * Menú contextual: clic derecho o botón «…». Flechas recorren, Enter elige, Esc o clic fuera cierra.
 * Uso: `const menu = useContextMenu()`, `onContextMenu={(e) => menu.openAt(e, items)}` y `{menu.element}`.
 */
export function useContextMenu(): {
  element: React.JSX.Element | null
  openAt: (e: React.MouseEvent, items: MenuEntry[]) => void
  openFrom: (anchor: HTMLElement, items: MenuEntry[]) => void
  close: () => void
} {
  const [state, setState] = useState<MenuState | null>(null)
  const close = useCallback(() => setState(null), [])

  const openAt = useCallback((e: React.MouseEvent, items: MenuEntry[]) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ x: e.clientX, y: e.clientY, items })
  }, [])

  const openFrom = useCallback((anchor: HTMLElement, items: MenuEntry[]) => {
    const box = anchor.getBoundingClientRect()
    setState({ x: box.right, y: box.bottom + 4, items })
  }, [])

  const element = state ? <ContextMenu {...state} onClose={close} /> : null
  return { element, openAt, openFrom, close }
}

function ContextMenu({
  x,
  y,
  items,
  onClose
}: MenuState & { onClose: () => void }): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  useOverlay(true, onClose, panel)

  // Que no se salga de la ventana: si no cabe, se abre hacia arriba o a la izquierda.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8))
    const top = y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y
    // eslint-disable-next-line react-hooks/set-state-in-effect -- medir y recolocar antes de pintar
    setPos({ left, top })
  }, [x, y])

  const move = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    ]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        ref={panel}
        role="menu"
        tabIndex={-1}
        onKeyDown={move}
        onMouseDown={(e) => e.stopPropagation()}
        style={pos}
        className="ui-menu toast-in fixed min-w-48 rounded-md bg-surface-raised p-1 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] outline-none"
      >
        {items.map((item, i) =>
          item === null ? (
            <div
              key={`sep-${i}`}
              role="separator"
              className="ui-menu-sep mx-2 my-1 h-px bg-hairline"
            />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                onClose()
                item.onSelect()
              }}
              className={`ui-menu-item ${item.danger ? 'ui-danger' : ''} flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-left text-caption font-bold transition-colors outline-none disabled:text-milk-faint ${
                item.danger
                  ? 'text-rose hover:bg-rose/15 focus-visible:bg-rose/15'
                  : 'text-milk hover:bg-hairline focus-visible:bg-hairline'
              }`}
            >
              {item.icon && (
                <span className="grid w-4 shrink-0 place-items-center text-milk-soft">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  )
}
