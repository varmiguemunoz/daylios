import type { ReactNode } from 'react'
import {
  Activity,
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
import { isMac, kbd } from '../../lib/platform'

interface AppShellProps {
  title: string
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void

  recorder: ReactNode
  account?: ReactNode
  org?: ReactNode

  onMore?: (anchor: HTMLElement) => void
  sidebar: Sidebar
  sections: ReactNode
  files: ReactNode
  activity?: ReactNode
  activityUnseen?: number
  onSearch: () => void
  onNewNote: () => void
  onNewBoard: () => void
  onSettings: () => void
  settingsActive: boolean
  children: ReactNode
}

const TABS: { id: SidebarTab; label: string; Icon: typeof Files }[] = [
  { id: 'sections', label: 'Secciones', Icon: LayoutGrid },
  { id: 'files', label: 'Archivos', Icon: Files },
  { id: 'activity', label: 'Actividad', Icon: Activity }
]

export function AppShell({
  title,
  canBack,
  canForward,
  onBack,
  onForward,
  recorder,
  account,
  org,
  onMore,
  sidebar,
  sections,
  files,
  activity,
  activityUnseen = 0,
  onSearch,
  onNewNote,
  onNewBoard,
  onSettings,
  settingsActive,
  children
}: AppShellProps): React.JSX.Element {
  const tab = sidebar.tab === 'activity' && !activity ? 'sections' : sidebar.tab
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
      <header
        className={`relative z-20 flex h-[38px] shrink-0 items-center gap-0.5 border-b border-ob-border bg-ob-alt [-webkit-app-region:drag] ${isMac() ? 'pr-2 pl-[80px]' : 'pr-[140px] pl-2'}`}
      >
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          <RibbonButton label={kbd('Atrás (⌘[)')} onClick={onBack} disabled={!canBack}>
            <ChevronLeft size={17} />
          </RibbonButton>
          <RibbonButton label={kbd('Adelante (⌘])')} onClick={onForward} disabled={!canForward}>
            <ChevronRight size={17} />
          </RibbonButton>
        </div>
        <p className="pointer-events-none absolute inset-x-[240px] truncate text-center text-[12px] text-ob-muted">
          {title}
        </p>
        <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
          {recorder}
          {account}
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
            label={kbd('Barra lateral (⌘\\)')}
            onClick={sidebar.toggle}
            active={sidebar.visible}
          >
            <PanelLeft size={17} />
          </RibbonButton>
          <RibbonButton label={kbd('Buscar en todo (⌘K)')} onClick={onSearch}>
            <Search size={17} />
          </RibbonButton>
          <RibbonButton label={kbd('Nueva nota (⌘N)')} onClick={onNewNote}>
            <FilePlus2 size={17} />
          </RibbonButton>
          <RibbonButton label="Nuevo board" onClick={onNewBoard}>
            <Shapes size={17} />
          </RibbonButton>
          <div className="mt-auto flex flex-col items-center gap-1">
            {org}
            <RibbonButton label={kbd('Ajustes (⌘,)')} onClick={onSettings} active={settingsActive}>
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
              {TABS.filter((t) => t.id !== 'activity' || activity).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-label={label}
                  title={label}
                  onClick={() => sidebar.show(id)}
                  className={`flex h-[26px] items-center gap-1.5 rounded-[4px] px-2 text-[12px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
                    tab === id ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
                  }`}
                >
                  <Icon size={14} aria-hidden />
                  {(tab === id || sidebar.width >= 320) && label}
                  {id === 'activity' && activityUnseen > 0 && (
                    <span
                      aria-label={`${activityUnseen} sin ver`}
                      className="grid h-4 min-w-4 place-items-center rounded-full bg-ob-accent px-1 text-[10px] font-semibold text-white tabular-nums"
                    >
                      {activityUnseen > 99 ? '99+' : activityUnseen}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Las dos vistas quedan montadas: el explorador no se recarga al cambiar de pestaña. */}
            <div
              role="tabpanel"
              aria-hidden={tab !== 'sections'}
              className={`min-h-0 flex-1 flex-col ${tab === 'sections' ? 'flex' : 'hidden'}`}
            >
              {sections}
            </div>
            <div
              role="tabpanel"
              aria-hidden={tab !== 'files'}
              className={`min-h-0 flex-1 flex-col ${tab === 'files' ? 'flex' : 'hidden'}`}
            >
              {files}
            </div>
            {activity && (
              <div
                role="tabpanel"
                aria-hidden={tab !== 'activity'}
                className={`min-h-0 flex-1 flex-col ${tab === 'activity' ? 'flex' : 'hidden'}`}
              >
                {activity}
              </div>
            )}
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
