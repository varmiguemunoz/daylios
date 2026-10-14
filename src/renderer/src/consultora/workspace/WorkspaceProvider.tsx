import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { WorkspaceItem } from '@shared/workspace'
import { useContextMenu } from '../../ui'
import type { Go, Screen } from '../lib'
import { isWorkspaceScreen } from '../sections'
import { prefs, ws } from './lib'
import { WorkspaceContext, type WorkspaceState } from './context'
import { useItemActions } from './organisms/useItemActions'
import { QuickSwitcher } from './organisms/QuickSwitcher'

const LAST_KEY = 'ws.last'
export const WORKSPACE_HOME: Screen = { name: 'workspace', folder: null }

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
  return WORKSPACE_HOME
}

const activeIdOf = (s: Screen): string | null =>
  s.name === 'workspace'
    ? s.folder
    : s.name === 'ws-note' || s.name === 'ws-board' || s.name === 'ws-image'
      ? s.id
      : null

/**
 * Estado del workspace para toda la ventana: el explorador vive en la barra lateral de todas las
 * secciones, así que lo que necesita (acciones, elemento abierto, selector) se monta en el marco.
 */
export function WorkspaceProvider({
  screen,
  go,
  children
}: {
  screen: Screen
  go: Go
  children: ReactNode
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [switcher, setSwitcher] = useState(false)
  const [active, setActive] = useState<WorkspaceItem | null>(null)
  const menu = useContextMenu()
  const activeId = isWorkspaceScreen(screen) ? activeIdOf(screen) : null

  useEffect(() => {
    void ws.info().catch(() => undefined) // arranca el vigilante si cambió la carpeta en Ajustes
  }, [])

  // El elemento abierto (ruta en la franja, resaltado en el explorador, carpeta para crear).
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
    if (item.id === activeId || (active && active.path.startsWith(`${item.path}/`)))
      go(WORKSPACE_HOME)
  })
  const folderId = !active ? null : active.kind === 'folder' ? active.id : active.parentId

  const openSwitcher = useCallback(() => setSwitcher(true), [])
  const openMore = (anchor: HTMLElement): void => {
    if (active) menu.openFrom(anchor, actions.itemMenu(active).slice(1))
  }

  const state: WorkspaceState = {
    go,
    actions,
    folderId,
    activeId,
    active,
    error,
    setError,
    openSwitcher,
    openMore
  }

  return (
    <WorkspaceContext.Provider value={state}>
      {children}
      {switcher && <QuickSwitcher onClose={() => setSwitcher(false)} />}
      {menu.element}
      {actions.dialogs}
    </WorkspaceContext.Provider>
  )
}
