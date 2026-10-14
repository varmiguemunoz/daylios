import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Files,
  LayoutGrid,
  MoreHorizontal,
  PanelLeft,
  Search,
  Settings,
  Shapes
} from 'lucide-react'
import { RibbonButton } from './RibbonButton'
import type { Sidebar, SidebarTab } from './useSidebar'

interface AppShellProps {
  /** Ruta de lo abierto, en el centro de la franja («Clientes › Acme»). */
  title: string
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
  /** Control de grabación: vive en la franja para que nunca se desmonte. */
  recorder: ReactNode
  /** Menú «…» de lo abierto, si tiene. */
  onMore?: (anchor: HTMLElement) => void
  sidebar: Sidebar
  sections: ReactNode
  files: ReactNode
  onSearch: () => void
  onNewNote: () => void
  onNewBoard: () => void
  onSettings: () => void
  settingsActive: boolean
  children: ReactNode
}

const TABS: { id: SidebarTab; label: string; Icon: typeof Files }[] = [
  { id: 'sections', label: 'Secciones', Icon: LayoutGrid },
  { id: 'files', label: 'Archivos', Icon: Files }
]

/**
 * Marco de toda la ventana Consultora, como Obsidian: franja de 38 px para arrastrar la ventana,
 * cinta de iconos, barra lateral con pestañas y el panel principal. No cambia al cambiar de sección.
 */
export function AppShell({
  title,
  canBack,
  canForward,
  onBack,
  onForward,
  recorder,
  onMore,
  sidebar,
  sections,
  files,
  onSearch,
  onNewNote,
  onNewBoard,
  onSettings,
  settingsActive,
  children
}: AppShellProps): React.JSX.Element {
  /** Arrastrar el borde de la barra cambia su ancho (se recuerda al soltar). */
  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebar.width
    let next = startWidth
    const move = (ev: PointerEvent): void => {
      next = startWidth + ev.clientX - startX
      sidebar.setWidth(next)
    }
    const up = (): void => {
      sidebar.setWidth(next, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="flex h-full flex-col bg-ob-bg font-ob text-ob-text">
      <header className="relative z-20 flex h-[38px] shrink-0 items-center gap-0.5 border-b border-ob-border bg-ob-alt pr-2 pl-[80px] [-webkit-app-region:drag]">
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          <RibbonButton label="Atrás (⌘[)" onClick={onBack} disabled={!canBack}>
            <ChevronLeft size={17} />
          </RibbonButton>
          <RibbonButton label="Adelante (⌘])" onClick={onForward} disabled={!canForward}>
            <ChevronRight size={17} />
          </RibbonButton>
        </div>
        <p className="pointer-events-none absolute inset-x-[240px] truncate text-center text-[12px] text-ob-muted">
          {title}
        </p>
        <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
          {recorder}
          {onMore && (
            <RibbonButton label="Más opciones" onClick={(e) => onMore(e.currentTarget)}>
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
          <RibbonButton
            label="Barra lateral (⌘\)"
            onClick={sidebar.toggle}
            active={sidebar.visible}
          >
            <PanelLeft size={17} />
          </RibbonButton>
          <RibbonButton label="Buscar en todo (⌘K)" onClick={onSearch}>
            <Search size={17} />
          </RibbonButton>
          <RibbonButton label="Nueva nota (⌘N)" onClick={onNewNote}>
            <FilePlus2 size={17} />
          </RibbonButton>
          <RibbonButton label="Nuevo board" onClick={onNewBoard}>
            <Shapes size={17} />
          </RibbonButton>
          <div className="mt-auto">
            <RibbonButton label="Ajustes (⌘,)" onClick={onSettings} active={settingsActive}>
              <Settings size={17} />
            </RibbonButton>
          </div>
        </nav>

        {sidebar.visible && (
          <aside
            aria-label="Barra lateral"
            style={{ width: sidebar.width }}
            className="relative flex shrink-0 flex-col border-r border-ob-border bg-ob-alt"
          >
            <div
              role="tablist"
              aria-label="Vistas"
              className="flex h-9 shrink-0 items-center gap-0.5 border-b border-ob-border px-2"
            >
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={sidebar.tab === id}
                  title={label}
                  onClick={() => sidebar.show(id)}
                  className={`flex h-[26px] items-center gap-1.5 rounded-[4px] px-2 text-[12px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
                    sidebar.tab === id ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
                  }`}
                >
                  <Icon size={14} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {/* Las dos vistas quedan montadas: el explorador no se recarga al cambiar de pestaña. */}
            <div
              role="tabpanel"
              aria-hidden={sidebar.tab !== 'sections'}
              className={`min-h-0 flex-1 flex-col ${sidebar.tab === 'sections' ? 'flex' : 'hidden'}`}
            >
              {sections}
            </div>
            <div
              role="tabpanel"
              aria-hidden={sidebar.tab !== 'files'}
              className={`min-h-0 flex-1 flex-col ${sidebar.tab === 'files' ? 'flex' : 'hidden'}`}
            >
              {files}
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Cambiar ancho de la barra lateral"
              onPointerDown={startResize}
              className="absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize hover:bg-ob-accent/40"
            />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-ob-bg">{children}</main>
      </div>
    </div>
  )
}
