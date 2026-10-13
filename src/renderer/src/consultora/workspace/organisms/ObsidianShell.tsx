import { useRef, useState, type ReactNode } from 'react'
import {
  FilePlus2,
  LayoutGrid,
  MoreHorizontal,
  PanelLeft,
  Search,
  Settings,
  Shapes
} from 'lucide-react'
import { useChrome } from '../../chrome'
import { prefs } from '../lib'
import { ConsultoraNavPanel } from './ConsultoraNavPanel'

const WIDTH_KEY = 'ws.explorer.width'
const MIN = 180
const MAX = 480

interface ObsidianShellProps {
  /** Nombre del archivo abierto (franja superior). */
  title: string
  explorerOpen: boolean
  onToggleExplorer: () => void
  explorer: ReactNode
  onSearch: () => void
  onNewNote: () => void
  onNewBoard: () => void
  /** Menú del archivo abierto (renombrar, mover, Finder, borrar). */
  onMore?: (anchor: HTMLElement) => void
  children: ReactNode
}

/**
 * Marco del workspace, como Obsidian: franja superior para arrastrar la ventana, cinta de iconos,
 * explorador redimensionable y el panel principal. Nada de la Consultora a la vista.
 */
export function ObsidianShell({
  title,
  explorerOpen,
  onToggleExplorer,
  explorer,
  onSearch,
  onNewNote,
  onNewBoard,
  onMore,
  children
}: ObsidianShellProps): React.JSX.Element {
  const { recording, openSection } = useChrome()
  const [nav, setNav] = useState(false)
  const [width, setWidth] = useState(() => {
    const saved = Number(prefs.get(WIDTH_KEY))
    return saved >= MIN && saved <= MAX ? saved : 260
  })
  const dragging = useRef(false)

  /** Arrastrar el borde del explorador cambia su ancho (se recuerda). */
  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startWidth = width
    let next = startWidth
    const move = (ev: PointerEvent): void => {
      next = Math.max(MIN, Math.min(MAX, startWidth + ev.clientX - startX))
      setWidth(next)
    }
    const up = (): void => {
      dragging.current = false
      prefs.set(WIDTH_KEY, String(next))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="flex h-full flex-col bg-ob-bg font-ob text-ob-text">
      <header className="relative flex h-[38px] shrink-0 items-center border-b border-ob-border bg-ob-alt pr-2 pl-[80px] [-webkit-app-region:drag]">
        <p className="pointer-events-none absolute inset-x-[200px] truncate text-center text-[12px] text-ob-muted">
          {title}
        </p>
        <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
          {recording && (
            <button
              type="button"
              onClick={() => openSection('meetings')}
              title="Grabación en curso: ir a Reuniones para detenerla"
              className="flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-[11px] font-semibold tracking-wide text-ob-red hover:bg-ob-hover"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-ob-red" aria-hidden />
              REC
            </button>
          )}
          {onMore && (
            <RibbonButton label="Más opciones del archivo" onClick={(e) => onMore(e.currentTarget)}>
              <MoreHorizontal size={16} />
            </RibbonButton>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <nav
          aria-label="Cinta"
          className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-ob-border bg-ob-alt py-2"
        >
          <RibbonButton label="Menú de Consultora" onClick={() => setNav((v) => !v)} active={nav}>
            <LayoutGrid size={17} />
          </RibbonButton>
          <RibbonButton
            label="Mostrar u ocultar explorador (⌘\)"
            onClick={onToggleExplorer}
            active={explorerOpen}
          >
            <PanelLeft size={17} />
          </RibbonButton>
          <RibbonButton label="Buscar archivo (⌘O)" onClick={onSearch}>
            <Search size={17} />
          </RibbonButton>
          <RibbonButton label="Nueva nota (⌘N)" onClick={onNewNote}>
            <FilePlus2 size={17} />
          </RibbonButton>
          <RibbonButton label="Nuevo board" onClick={onNewBoard}>
            <Shapes size={17} />
          </RibbonButton>
          <div className="mt-auto">
            <RibbonButton label="Ajustes" onClick={() => openSection('settings')}>
              <Settings size={17} />
            </RibbonButton>
          </div>
        </nav>

        {explorerOpen && (
          <aside
            aria-label="Explorador"
            style={{ width }}
            className="relative flex shrink-0 flex-col border-r border-ob-border bg-ob-alt"
          >
            {explorer}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Cambiar ancho del explorador"
              onPointerDown={startResize}
              className="absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize hover:bg-ob-accent/40"
            />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-ob-bg">{children}</main>

        {nav && <ConsultoraNavPanel onClose={() => setNav(false)} />}
      </div>
    </div>
  )
}

export function RibbonButton({
  label,
  onClick,
  active = false,
  children
}: {
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-[4px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
        active ? 'text-ob-text' : 'text-ob-muted'
      }`}
    >
      {children}
    </button>
  )
}
