import { useCallback, useState } from 'react'
import { prefs } from '../workspace/lib'

export type SidebarTab = 'sections' | 'files'
/** El workspace y el resto recuerdan su pestaña por separado. */
export type SidebarContext = 'workspace' | 'consultora'

const VISIBLE_KEY = 'shell.sidebar.visible'
const WIDTH_KEY = 'shell.sidebar.width'
const TAB_KEY = (c: SidebarContext): string => `shell.sidebar.tab.${c}`
const DEFAULT_TAB: Record<SidebarContext, SidebarTab> = {
  workspace: 'files',
  consultora: 'sections'
}

export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 480

const readTab = (c: SidebarContext): SidebarTab => {
  const v = prefs.get(TAB_KEY(c))
  return v === 'sections' || v === 'files' ? v : DEFAULT_TAB[c]
}

export interface Sidebar {
  visible: boolean
  toggle: () => void
  tab: SidebarTab
  /** Elige pestaña y muestra la barra si estaba oculta. */
  show: (tab: SidebarTab) => void
  width: number
  setWidth: (width: number, persist?: boolean) => void
}

/** Estado de la barra lateral izquierda: visible, ancho y pestaña por contexto. Todo se recuerda. */
export function useSidebar(context: SidebarContext): Sidebar {
  const [visible, setVisible] = useState(() => prefs.get(VISIBLE_KEY) !== '0')
  const [tabs, setTabs] = useState<Record<SidebarContext, SidebarTab>>(() => ({
    workspace: readTab('workspace'),
    consultora: readTab('consultora')
  }))
  const [width, setWidthState] = useState(() => {
    const saved = Number(prefs.get(WIDTH_KEY))
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 260
  })

  const toggle = useCallback(() => {
    setVisible((v) => {
      prefs.set(VISIBLE_KEY, v ? '0' : '1')
      return !v
    })
  }, [])

  const show = useCallback(
    (tab: SidebarTab) => {
      setTabs((t) => ({ ...t, [context]: tab }))
      prefs.set(TAB_KEY(context), tab)
      setVisible(true)
      prefs.set(VISIBLE_KEY, '1')
    },
    [context]
  )

  const setWidth = useCallback((next: number, persist = false) => {
    const w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, next))
    setWidthState(w)
    if (persist) prefs.set(WIDTH_KEY, String(w))
  }, [])

  return { visible, toggle, tab: tabs[context], show, width, setWidth }
}
