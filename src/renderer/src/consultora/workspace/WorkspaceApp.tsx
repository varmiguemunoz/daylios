import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { WorkspaceItem } from '@shared/workspace'
import { useContextMenu } from '../../ui'
import type { Go, Screen } from '../lib'
import { prefs, ws } from './lib'
import { WorkspaceContext, type WorkspaceState } from './context'
import { useItemActions } from './organisms/useItemActions'
import { ObsidianShell } from './organisms/ObsidianShell'
import { FileExplorer } from './organisms/FileExplorer'
import { QuickSwitcher } from './organisms/QuickSwitcher'
import { HomePane } from './screens/HomePane'
import { FolderPane } from './screens/FolderPane'
import { NotePane } from './screens/NotePane'
import { BoardPane } from './screens/BoardPane'
import { ImagePane } from './screens/ImagePane'

const LAST_KEY = 'ws.last'
const EXPLORER_KEY = 'ws.explorer.visible'
const HOME: Screen = { name: 'workspace', folder: null }

/** Recuerda la última pantalla del workspace (el atajo global vuelve ahí). */
export function rememberWorkspaceScreen(screen: Screen): void {
  prefs.set(LAST_KEY, JSON.stringify(screen))
}

export function lastWorkspaceScreen(): Screen {
  try {
    const s = JSON.parse(prefs.get(LAST_KEY) ?? 'null') as Screen | null
    if (
      s &&
      (s.name === 'ws-note' || s.name === 'ws-board' || s.name === 'ws-image') &&
      typeof s.id === 'string'
    )
      return s
    if (s && s.name === 'workspace') return s
  } catch {
    // preferencia dañada
  }
  return HOME
}

const activeIdOf = (s: Screen): string | null =>
  s.name === 'workspace'
    ? s.folder
    : s.name === 'ws-note' || s.name === 'ws-board' || s.name === 'ws-image'
      ? s.id
      : null

/**
 * El workspace completo, estilo Obsidian. Una sola instancia mientras se navega por él: el explorador
 * no se vuelve a montar al abrir otro archivo. Activa el tema Obsidian en <body> (también para los
 * diálogos) y avisa a main de que el workspace está delante (atajo global).
 */
export function WorkspaceApp({
  screen,
  go,
  back
}: {
  screen: Screen
  go: Go
  back: () => void
  canGoBack: boolean
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [switcher, setSwitcher] = useState(false)
  const [active, setActive] = useState<WorkspaceItem | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(() => prefs.get(EXPLORER_KEY) !== '0')
  const menu = useContextMenu()
  const activeId = activeIdOf(screen)

  useEffect(() => {
    document.body.classList.add('theme-obsidian')
    window.api.setWorkspaceActive(true)
    void ws.info().catch(() => undefined) // arranca el vigilante si cambió la carpeta en Ajustes
    const onFocus = (): void => window.api.setWorkspaceActive(true)
    window.addEventListener('focus', onFocus)
    return () => {
      document.body.classList.remove('theme-obsidian')
      window.api.setWorkspaceActive(false)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // El elemento abierto (nombre en la franja, resaltado en el explorador, carpeta para crear).
  const refreshActive = useCallback(() => {
    if (!activeId) return setActive(null)
    ws.get(activeId)
      .then(setActive)
      .catch(() => setActive(null))
  }, [activeId])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sin elemento abierto se limpia al momento
    refreshActive()
    return window.api.onDataChanged(refreshActive)
  }, [refreshActive])

  const actions = useItemActions(go, setError, (item) => {
    if (item.id === activeId || (active && active.path.startsWith(`${item.path}/`))) go(HOME)
  })
  const folderId = !active ? null : active.kind === 'folder' ? active.id : active.parentId

  const toggleExplorer = useCallback(() => {
    setExplorerOpen((v) => {
      prefs.set(EXPLORER_KEY, v ? '0' : '1')
      return !v
    })
  }, [])

  // Atajos del workspace: ⌘O ⌘F ⌘K buscar · ⌘N nota nueva · ⌘\ explorador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'o' || key === 'f' || key === 'k') {
        e.preventDefault()
        setSwitcher(true)
      } else if (key === 'n') {
        e.preventDefault()
        void actions.newNote(folderId)
      } else if (key === '\\') {
        e.preventDefault()
        toggleExplorer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, folderId, toggleExplorer])

  const state: WorkspaceState = { go, actions, folderId, activeId, setError }
  const title = active ? (active.kind === 'folder' ? active.name : active.path) : 'Workspace'

  return (
    <WorkspaceContext.Provider value={state}>
      <ObsidianShell
        title={title}
        explorerOpen={explorerOpen}
        onToggleExplorer={toggleExplorer}
        explorer={<FileExplorer activePath={active?.path ?? ''} />}
        onSearch={() => setSwitcher(true)}
        onNewNote={() => void actions.newNote(folderId)}
        onNewBoard={() => void actions.newBoard(folderId)}
        onMore={
          active && active.kind !== 'folder'
            ? (anchor) => menu.openFrom(anchor, actions.itemMenu(active).slice(1))
            : undefined
        }
      >
        {error && (
          <p
            role="alert"
            className="flex items-center gap-3 border-b border-ob-border bg-ob-red/10 px-4 py-2 text-[13px] text-ob-red"
          >
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setError(null)}
              className="text-ob-muted hover:text-ob-text"
            >
              <X size={14} />
            </button>
          </p>
        )}
        <Pane
          key={`${screen.name}:${activeId ?? ''}`}
          screen={screen}
          back={back}
          onSearch={() => setSwitcher(true)}
        />
      </ObsidianShell>
      {switcher && <QuickSwitcher onClose={() => setSwitcher(false)} />}
      {menu.element}
      {actions.dialogs}
    </WorkspaceContext.Provider>
  )
}

function Pane({
  screen,
  back,
  onSearch
}: {
  screen: Screen
  back: () => void
  onSearch: () => void
}): React.JSX.Element | null {
  switch (screen.name) {
    case 'workspace':
      return screen.folder ? (
        <FolderPane folderId={screen.folder} />
      ) : (
        <HomePane onSearch={onSearch} />
      )
    case 'ws-note':
      return <NotePane id={screen.id} />
    case 'ws-board':
      return <BoardPane id={screen.id} />
    case 'ws-image':
      return <ImagePane id={screen.id} onGone={back} />
    default:
      return null
  }
}
